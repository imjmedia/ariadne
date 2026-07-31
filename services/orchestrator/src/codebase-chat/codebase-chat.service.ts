/**
 * ask_codebase / chat NL: LangGraph multi-agente (route → specialist → synthesize).
 */
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { START, END, StateGraph, Annotation } from '@langchain/langgraph';
import type { ChatIntent } from 'ariadne-common';
import { EXAMPLES, EXPLORER_TOOLS_ALL, SCHEMA } from './chat.constants';
import type { ChatScope } from './chat-scope.util';
import { IngestChatClient } from './ingest-chat.client';
import { OrchestratorLlmService } from './orchestrator-llm.service';
import type { LlmMessage } from '../llm/orchestrator-llm.facade';
import { LlmContextLengthError } from 'ariadne-common';
import { isMoonshotRateLimitError } from '../llm/moonshot-rate-limit.error';
import { isLlmAuthError } from '../llm/llm-auth.error';
import { RedisStateService } from '../redis-state/redis-state.service';
import type { RetrieverToolName } from './ingest-types';
import { ChatIntentRouterAgent } from './agents/chat-intent-router.agent';
import { ChatReengineeringAgent } from './agents/chat-reengineering.agent';
import { ChatIntegrationHandoffAgent } from './agents/chat-integration-handoff.agent';
import { wantsIntegrationHandoffQuestion } from 'ariadne-common';
import { formatHandoffAuditFailureAnswer } from './handoff-audit-error.util';
import type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
} from './codebase-chat.state';

export type { ChatMessage, ChatRequest, ChatResponse } from './codebase-chat.state';

const lastValue = <T>(x: T, y: T) => (y !== undefined && y !== null ? y : x);

function defaultTwoPhaseFromEnv(): boolean {
  const v = process.env.CHAT_TWO_PHASE?.trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'off') return false;
  return true;
}

function buildRetrievalSummaryJson(collectedResults: unknown[], gatheredContext: string): string {
  const paths = new Set<string>();
  const repoIds = new Set<string>();
  for (const r of collectedResults) {
    if (r && typeof r === 'object') {
      const o = r as Record<string, unknown>;
      const p = o.path ?? o.fnPath ?? o.file;
      if (typeof p === 'string' && p.length) paths.add(p);
      const rid = o.repoId ?? o.repo_id;
      if (typeof rid === 'string' && rid.length) repoIds.add(rid);
    }
  }
  const ctxPaths = gatheredContext.match(/\b[\w.-]+\/[\w./-]+\.(tsx?|jsx?|mjs|cjs)\b/g) ?? [];
  for (const p of ctxPaths) paths.add(p);
  return JSON.stringify(
    {
      phase: 'retrieval_summary',
      topPaths: [...paths].slice(0, 120),
      repoIds: [...repoIds],
      structuredRowCount: collectedResults.length,
      instruction:
        'Prioriza citar rutas de topPaths; no inventes paths ni repos que no aparezcan aquí o en el contexto bruto.',
    },
    null,
    2,
  );
}

const CodebaseChatStateAnnotation = Annotation.Root({
  repositoryId: Annotation<string>(),
  projectId: Annotation<string>(),
  message: Annotation<string>(),
  historyContent: Annotation<string | undefined>({ value: lastValue, default: () => undefined }),
  projectScope: Annotation<boolean>({ value: lastValue, default: () => false }),
  scope: Annotation<ChatScope | undefined>({ value: lastValue, default: () => undefined }),
  useTwoPhase: Annotation<boolean>({ value: lastValue, default: () => true }),
  evidenceFirst: Annotation<boolean>({ value: lastValue, default: () => false }),
  rawEvidence: Annotation<boolean>({ value: lastValue, default: () => false }),
  deterministicRetriever: Annotation<boolean>({ value: lastValue, default: () => false }),
  threadId: Annotation<string | undefined>({ value: lastValue, default: () => undefined }),
  lastCypher: Annotation<string | undefined>({ value: lastValue, default: () => undefined }),
  collectedResults: Annotation<unknown[]>({
    value: (_a, b) => (Array.isArray(b) ? b : []),
    default: () => [],
  }),
  gatheredContext: Annotation<string>({ value: lastValue, default: () => '' }),
  answer: Annotation<string | undefined>({ value: lastValue, default: () => undefined }),
  resultOut: Annotation<unknown[] | undefined>({ value: lastValue, default: () => undefined }),
  skipIntentRouter: Annotation<boolean>({ value: lastValue, default: () => false }),
  integrationHandoffId: Annotation<string | undefined>({ value: lastValue, default: () => undefined }),
  chatMode: Annotation<string | undefined>({ value: lastValue, default: () => undefined }),
  chatIntent: Annotation<ChatIntent | undefined>({ value: lastValue, default: () => undefined }),
  intentRoute: Annotation<import('ariadne-common').ChatIntentRouteResult | undefined>({
    value: lastValue,
    default: () => undefined,
  }),
});

export type CodebaseChatState = typeof CodebaseChatStateAnnotation.State;

/**
 * Cuando el retrieve no devuelve contexto: no implica que Falkor esté vacío (suele ser alcance,
 * chat por proyecto vs repo, o ReAct sin herramientas útiles). Guía al usuario más allá de "resync".
 */
function emptyRetrieverUserMessage(state: CodebaseChatState): string {
  const repoIds = (state.scope?.repoIds ?? []).map((x) => String(x).trim()).filter(Boolean);
  const lines: string[] = [
    '**sin datos en índice para este alcance** — el retrieve (Cypher / archivos / RAG) no aportó filas ni contenido útil en esta petición.',
    '',
    '**Qué revisar** (el sync puede estar correcto y el grafo poblado):',
  ];
  if (state.projectScope) {
    lines.push(
      '- **Chat por proyecto:** con varios repos, elige el repo en la UI, envía `scope.repoIds`, activa **chat amplio** (`strictChatScope: false`) o abre el chat desde la ruta **/repos/:id/chat** del repositorio deseado.',
    );
  }
  if (repoIds.length > 0) {
    lines.push(
      `- **scope.repoIds:** llevas **${repoIds.length}** id(s); confirma que incluyen el repositorio donde indexaste.`,
    );
  }
  lines.push(
    '- **Verificar grafo:** `GET /api/repositories/:id/graph-summary?full=1` (multi-root: prueba también el query `repoScoped=1`).',
    '- **RAG:** si esperas `semantic_search` útil, ejecuta **embed-index** en el repo.',
    '- **Operadores:** `CHAT_TELEMETRY_LOG=true` en orchestrator e ingest para ver `chat_scope_effective` en logs.',
  );
  return lines.join('\n');
}

function initialStateFromRequest(
  repositoryId: string,
  projectId: string,
  projectScope: boolean,
  req: ChatRequest,
): CodebaseChatState {
  const historyContent = (req.history ?? [])
    .slice(-8)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');
  const rawEvidence = req.responseMode === 'raw_evidence';
  const evidenceFirst = !rawEvidence && req.responseMode === 'evidence_first';
  const useTwoPhase = rawEvidence || evidenceFirst ? true : (req.twoPhase ?? defaultTwoPhaseFromEnv());
  return {
    repositoryId,
    projectId,
    message: req.message,
    historyContent,
    projectScope,
    scope: req.scope,
    useTwoPhase,
    evidenceFirst,
    rawEvidence,
    deterministicRetriever: Boolean(req.deterministicRetriever) && rawEvidence,
    threadId: req.threadId,
    lastCypher: undefined,
    collectedResults: [],
    gatheredContext: '',
    answer: undefined,
    resultOut: undefined,
    skipIntentRouter: rawEvidence || evidenceFirst,
    integrationHandoffId: req.integrationHandoffId?.trim() || undefined,
    chatMode: req.chatMode?.trim() || undefined,
    chatIntent: undefined,
    intentRoute: undefined,
  };
}

@Injectable()
export class CodebaseChatService {
  private readonly logger = new Logger(CodebaseChatService.name);
  private graph: { invoke: (s: CodebaseChatState) => Promise<CodebaseChatState> } | null = null;

  constructor(
    private readonly llm: OrchestratorLlmService,
    private readonly ingest: IngestChatClient,
    private readonly redis: RedisStateService,
    private readonly intentRouter: ChatIntentRouterAgent,
    private readonly reengineeringAgent: ChatReengineeringAgent,
    private readonly integrationHandoffAgent: ChatIntegrationHandoffAgent,
  ) {}

  async chatRepository(repositoryId: string, req: ChatRequest): Promise<ChatResponse> {
    return this.runChat(initialStateFromRequest(repositoryId, repositoryId, false, req));
  }

  async chatProject(projectId: string, req: ChatRequest): Promise<ChatResponse> {
    let repos = await this.ingest.listRepositories(projectId);
    if (repos.length === 0) {
      const maybe = await this.ingest.getRepository(projectId);
      if (maybe) {
        return this.chatRepository(projectId, req);
      }
      return { answer: 'Este proyecto no tiene repositorios indexados. Añade al menos un repo y haz sync.' };
    }
    const scopeRepoIds = Array.from(
      new Set((req.scope?.repoIds ?? []).map((x) => String(x).trim()).filter(Boolean)),
    );
    if (scopeRepoIds.length === 1) {
      const only = scopeRepoIds[0];
      if (repos.some((r) => r.id === only)) {
        return this.chatRepository(only, req);
      }
    }
    const firstRepoId = repos[0].id;
    return this.runChat(initialStateFromRequest(firstRepoId, projectId, true, req));
  }

  private async runChat(initial: CodebaseChatState): Promise<ChatResponse> {
    const out = await this.invokeCodebaseGraph(initial);
    const answer = (out.answer ?? '').trim();
    let mddDocument: Record<string, unknown> | undefined;
    if (out.evidenceFirst && answer.startsWith('{')) {
      try {
        mddDocument = JSON.parse(answer) as Record<string, unknown>;
      } catch {
        mddDocument = undefined;
      }
    }
    return {
      answer,
      cypher: out.lastCypher || undefined,
      result: out.resultOut && out.resultOut.length > 0 ? out.resultOut : undefined,
      mddDocument,
      intentRoute: out.intentRoute,
    };
  }

  private async invokeCodebaseGraph(initial: CodebaseChatState): Promise<CodebaseChatState> {
    try {
      return await this.getGraph().invoke(initial);
    } catch (err) {
      if (isMoonshotRateLimitError(err)) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            error: 'MoonshotRateLimit',
            message: err.message,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (isLlmAuthError(err)) {
        throw new HttpException(
          {
            statusCode: HttpStatus.UNAUTHORIZED,
            error: 'LlmAuthError',
            message: err.message,
          },
          HttpStatus.UNAUTHORIZED,
        );
      }
      const contextLengthErr =
        err instanceof LlmContextLengthError ? err : null;
      if (contextLengthErr) {
        throw new HttpException(
          {
            statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
            error: 'LlmContextLengthError',
            code: 'LLM_CONTEXT_LENGTH_EXCEEDED',
            message: contextLengthErr.message,
            model: contextLengthErr.model,
            maxContextTokens: contextLengthErr.maxContextTokens,
            requestedTokens: contextLengthErr.requestedTokens,
          },
          HttpStatus.PAYLOAD_TOO_LARGE,
        );
      }
      throw err;
    }
  }

  private getGraph(): { invoke: (s: CodebaseChatState) => Promise<CodebaseChatState> } {
    if (!this.graph) this.graph = this.buildGraph();
    return this.graph;
  }

  private buildGraph(): { invoke: (s: CodebaseChatState) => Promise<CodebaseChatState> } {
    const svc = this;
    const workflow = new StateGraph(CodebaseChatStateAnnotation)
      .addNode('route_intent', (s) => svc.nodeRouteIntent(s))
      .addNode('handle_schema', (s) => svc.nodeHandleSchema(s))
      .addNode('handle_unused_api', (s) => svc.nodeHandleUnusedApi(s))
      .addNode('retrieve', (s) => svc.nodeRetrieve(s))
      .addNode('reengineering_audit', (s) => svc.nodeReengineeringAudit(s))
      .addNode('integration_handoff_audit', (s) => svc.nodeIntegrationHandoffAudit(s))
      .addNode('synthesize', (s) => svc.nodeSynthesize(s))
      .addEdge(START, 'route_intent')
      .addConditionalEdges('route_intent', (s) => svc.routeAfterIntent(s), {
        handle_schema: 'handle_schema',
        handle_unused_api: 'handle_unused_api',
        integration_handoff: 'integration_handoff_audit',
        retrieve: 'retrieve',
      })
      .addEdge('handle_schema', END)
      .addEdge('handle_unused_api', END)
      .addEdge('integration_handoff_audit', END)
      .addConditionalEdges('retrieve', (s) =>
        s.chatIntent === 'reengineering' ? 'reengineering_audit' : 'synthesize',
      )
      .addEdge('reengineering_audit', END)
      .addEdge('synthesize', END);
    return workflow.compile();
  }

  private routeAfterIntent(
    state: CodebaseChatState,
  ): 'handle_schema' | 'handle_unused_api' | 'integration_handoff' | 'retrieve' {
    switch (state.chatIntent) {
      case 'schema_database':
        return 'handle_schema';
      case 'unused_api_endpoints':
        return 'handle_unused_api';
      case 'integration_handoff':
        return 'integration_handoff';
      default:
        return 'retrieve';
    }
  }

  private async nodeRouteIntent(state: CodebaseChatState): Promise<Partial<CodebaseChatState>> {
    if (state.skipIntentRouter || state.rawEvidence || state.evidenceFirst) {
      return { chatIntent: 'codebase_qa' };
    }
    if (
      wantsIntegrationHandoffQuestion(state.message, {
        integrationHandoffId: state.integrationHandoffId,
        chatMode: state.chatMode,
      })
    ) {
      return {
        chatIntent: 'integration_handoff',
        intentRoute: {
          intent: 'integration_handoff',
          confidence: 0.95,
          reasoning: 'Handoff NEW-LEG / integración The Forge',
          source: 'keyword_fallback',
        },
      };
    }
    const route = await this.intentRouter.classify(state.message, state.historyContent);
    return { chatIntent: route.intent, intentRoute: route };
  }

  private async nodeHandleSchema(state: CodebaseChatState): Promise<Partial<CodebaseChatState>> {
    const res = state.projectScope
      ? await this.ingest.fetchSchemaDatabaseProject(state.projectId, state.scope)
      : await this.ingest.fetchSchemaDatabaseRepository(state.repositoryId, state.scope);
    return {
      answer: res.answer,
      lastCypher: res.cypher,
      resultOut: res.result,
    };
  }

  private async nodeHandleUnusedApi(state: CodebaseChatState): Promise<Partial<CodebaseChatState>> {
    const res = state.projectScope
      ? await this.ingest.fetchUnusedApiEndpointsProject(state.projectId, state.scope)
      : await this.ingest.fetchUnusedApiEndpointsRepository(state.repositoryId, state.scope);
    return {
      answer: res.answer,
      lastCypher: res.cypher,
      resultOut: res.result,
    };
  }

  private async nodeReengineeringAudit(state: CodebaseChatState): Promise<Partial<CodebaseChatState>> {
    try {
      const { answer } = await this.reengineeringAgent.runAudit(state);
      return {
        answer,
        resultOut: state.collectedResults.length > 0 ? state.collectedResults : undefined,
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return {
        answer: `No pude completar el análisis de reingeniería: ${detail}. Revisa que el servicio ingest esté disponible y vuelve a intentar con un alcance más acotado (prefijo de carpeta).`,
      };
    }
  }

  private async nodeIntegrationHandoffAudit(
    state: CodebaseChatState,
  ): Promise<Partial<CodebaseChatState>> {
    try {
      const { answer } = await this.integrationHandoffAgent.runAudit(state);
      return { answer };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return { answer: formatHandoffAuditFailureAnswer(detail) };
    }
  }

  private async nodeRetrieve(state: CodebaseChatState): Promise<Partial<CodebaseChatState>> {
    const rawEv = state.rawEvidence ?? false;
    const repositoryId = state.repositoryId;
    const scope = state.scope;
    const projectScope = state.projectScope;

    if (rawEv && (state.deterministicRetriever ?? false)) {
      const r = await this.ingest.gatherDeterministicRawEvidence(repositoryId, {
        message: state.message,
        scope,
        projectScope,
      });
      const gatheredContext = r.gatheredContext;
      const collectedResults = r.collectedResults;
      if (state.threadId?.trim()) {
        await this.redis.setChatThread(state.threadId.trim(), {
          phase: 'post_retrieve',
          repositoryId: state.repositoryId,
          projectId: state.projectId,
          gatheredContextChars: gatheredContext.length,
          collectedRows: collectedResults.length,
          at: new Date().toISOString(),
        });
      }
      return {
        lastCypher: r.lastCypher || undefined,
        collectedResults,
        gatheredContext,
      };
    }

    const tools = EXPLORER_TOOLS_ALL;
    const maxTurns = rawEv
      ? Math.min(20, Math.max(4, parseInt(process.env.CHAT_RAW_EVIDENCE_RETRIEVER_MAX_TURNS ?? '10', 10) || 10))
      : 4;
    const retrieverSystem = `<instrucciones>
Actúa como **Coordinador** y luego como **Validador** (ask_codebase agéntico).

**Coordinador:** Si la pregunta implica datos, API, esquema o contratos, NO te limites al grafo: usa execute_cypher Y get_file_content sobre schema.prisma, entidades TypeORM (:Model source=typeorm), swagger/openapi (File openApiTruth), package.json, .env.example, tsconfig.

**Validador:** Contrasta resultados del grafo con contenidos de archivo; solo considera evidencia anclada a path real devuelto por herramientas.

**Recolector:** Tu única salida en esta fase es reunir datos del grafo o archivos leídos.

Plan: 1) execute_cypher o get_graph_summary. 2) get_file_content en paths relevantes. 3) semantic_search si aplica.

**Tablas / esquema BD / modelos:** Prisma → MATCH (m:Model) WHERE m.source = 'prisma'; TypeORM → m.source = 'typeorm'. **API:** OpenApiOperation (swagger) con prioridad sobre NestController. **Env:** .env.example (fileRole env_example).

**Monorepos:** Explora todas las apps (apps/*, packages/*).

**Grounding:** No inventes rutas. Si una herramienta devuelve 0 filas, repórtalo tal cual.

NO escribas la respuesta final al usuario. Máx ${maxTurns} turnos.
</instrucciones>

<schema_cypher>
${SCHEMA}${EXAMPLES}
</schema_cypher>`;

    const message = state.message;
    const historyContent = state.historyContent;
    const userContent = historyContent
      ? `${historyContent}\n\n<user>${message}</user>`
      : `<user>${message}</user>`;

    const messages: LlmMessage[] = [
      { role: 'system', content: retrieverSystem },
      { role: 'user', content: userContent },
    ];

    let lastCypher = '';
    const collectedToolOutputs: string[] = [];
    const collectedResults: unknown[] = [];

    for (let turn = 0; turn < maxTurns; turn++) {
      const resp = await this.llm.callLlmWithTools(messages, tools);

      if (!resp.tool_calls?.length) {
        break;
      }

      messages.push({
        role: 'assistant',
        content: resp.content ?? null,
        ...('reasoning_content' in resp ? { reasoning_content: resp.reasoning_content ?? null } : {}),
        tool_calls: resp.tool_calls,
      });

      for (const tc of resp.tool_calls) {
        const fn = tc.function;
        let toolResult: string;
        try {
          const args = JSON.parse(fn.arguments) as Record<string, unknown>;
          const r = await this.ingest.executeRetrieverTool(repositoryId, {
            projectScope,
            scope,
            tool: fn.name as RetrieverToolName,
            arguments: args,
            fallbackMessage: message,
            evidenceVerbosity: rawEv ? 'full' : undefined,
          });
          if (r.lastCypher) lastCypher = r.lastCypher;
          collectedResults.push(...r.collectedRows);
          toolResult = r.toolResult;
        } catch (err) {
          toolResult = `Error: ${err instanceof Error ? err.message : String(err)}`;
        }
        collectedToolOutputs.push(toolResult);
        messages.push({ role: 'tool', tool_call_id: tc.id, content: toolResult });
      }
    }

    const gatheredContext = collectedToolOutputs.join('\n\n---\n\n');

    if (state.threadId?.trim()) {
      await this.redis.setChatThread(state.threadId.trim(), {
        phase: 'post_retrieve',
        repositoryId: state.repositoryId,
        projectId: state.projectId,
        gatheredContextChars: gatheredContext.length,
        collectedRows: collectedResults.length,
        at: new Date().toISOString(),
      });
    }

    return {
      lastCypher: lastCypher || undefined,
      collectedResults,
      gatheredContext,
    };
  }

  private async nodeSynthesize(state: CodebaseChatState): Promise<Partial<CodebaseChatState>> {
    const message = state.message;
    const evidenceFirst = state.evidenceFirst;
    const rawEvidence = state.rawEvidence ?? false;
    const useTwoPhase = state.useTwoPhase;
    const gatheredContext = state.gatheredContext ?? '';
    const collectedResults = state.collectedResults ?? [];

    if (rawEvidence) {
      const jsonAnswer = JSON.stringify(
        {
          mode: 'raw_evidence',
          deterministicRetriever: state.deterministicRetriever ?? false,
          gatheredContext,
          collectedResults,
          cypher: state.lastCypher,
        },
        null,
        2,
      );
      return {
        answer: jsonAnswer,
        resultOut: collectedResults.length > 0 ? collectedResults : undefined,
      };
    }

    if (evidenceFirst) {
      try {
        const mdd = await this.ingest.fetchMddEvidence(state.repositoryId, {
          message,
          gatheredContext,
          collectedResults,
          projectScope: state.projectScope,
        });
        const jsonAnswer = JSON.stringify(mdd, null, 2);
        return {
          answer: jsonAnswer,
          resultOut: collectedResults.length > 0 ? collectedResults : undefined,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          answer: JSON.stringify(
            {
              error: 'mdd_evidence_failed',
              message: msg,
              summary: 'Fallo al construir MDD en ingest; verifica INGEST_URL.',
            },
            null,
            2,
          ),
        };
      }
    }

    const retrievalJson =
      collectedResults.length > 0 || gatheredContext.trim().length > 0
        ? buildRetrievalSummaryJson(collectedResults, gatheredContext)
        : '';
    const evidenceFirstMaxChars = (() => {
      const n = parseInt(process.env.CHAT_EVIDENCE_FIRST_MAX_CHARS ?? '18000', 10);
      return Number.isFinite(n) && n >= 4000 ? Math.min(n, 100_000) : 18000;
    })();
    const twoPhaseContextCap = evidenceFirst ? evidenceFirstMaxChars : 12_000;
    const rawContextForSynth =
      useTwoPhase && gatheredContext.trim() ? gatheredContext.slice(0, twoPhaseContextCap) : gatheredContext;
    const evidenceFirstBlock = evidenceFirst
      ? `## Modo evidence_first (SDD / documentación)
- **Primera sección obligatoria:** \`## Evidencia\` — tabla o viñetas: \`path\` | hecho o símbolo **literal** del contexto siguiente.
- **Segunda sección:** \`## Resumen\` — máximo 6 viñetas; solo repite hechos ya en Evidencia.
- Prioriza **listas** sobre prosa larga. **PROHIBIDO** añadir archivos, stacks o APIs que no aparezcan en el contexto.
- Si un tema no está en el contexto: **(no consta en el índice)** — no inventes.

`
      : '';
    const synthesizerSystem = `${evidenceFirstBlock}## Rol
Eres un experto que explica código a colegas. Recibes **solo** datos crudos del contexto (Cypher, archivos, búsquedas) — son la única fuente de verdad para rutas y símbolos.

## Instrucciones
- Responde SIEMPRE en prosa clara, como lo haría un desarrollador senior.
- Explica procesos, flujos, impacto: "cómo es el proceso de X", "qué pasa si cambio Y", "qué componentes usan Z".
- Síntetiza: abstrae el flujo; no repitas listas crudas sin sentido (excepto cuando pidan listado explícito).
- Si preguntan por un proceso (ej. consulta a Falkor): describe el flujo paso a paso en lenguaje natural.
- **Sección "## Evidencia" (obligatoria si citas archivos, rutas, imports o porcentajes):** Lista en formato tabla o viñetas **solo** hechos presentes en el contexto: \`path\` | símbolo o detalle detectado | \`repoId\` (si aparece en los datos). Si el contexto no menciona repoId, omite esa columna. **PROHIBIDO** inventar filas de evidencia.
- **Inventario (flujos):** Tras explicar el flujo, puedes incluir "Este proceso involucra…" solo con archivos/funciones **mencionados en el contexto**. Si un path dice "No se pudo leer", indica que no está disponible en el repo indexado.
- **Reporte detallado / listado completo:** Si piden "reporte detallado", "listado de todos", "código no utilizado" → INCLUYE el listado completo **de los datos recibidos**, no ejemplos inventados.

## Restricciones (grounding)
- Si el contexto indica **0 filas**, **sin datos en índice**, o diagnóstico de embeddings vacío: dilo explícitamente (**"sin datos en índice para este alcance"** o la razón dada). **PROHIBIDO** rellenar con suposiciones, rutas genéricas o "puede que…".
- PROHIBIDO listas de paths o porcentajes que no aparezcan en el contexto.
- **Listas "archivos a modificar":** solo rutas literales del contexto. Si propones archivos concretos, incluye sección **## Archivos a tocar** con tabla **path | repoId | qué tocar/modificar | símbolo** (columna **qué tocar/modificar** obligatoria). Si no hay ninguna: **sin datos en índice para este alcance**.
- En español. 200-500 palabras para procesos salvo listados explícitos.`;

    const structuredBlock =
      useTwoPhase && retrievalJson
        ? `## Resumen estructurado del retrieval (prioridad — fase 1)
${retrievalJson}

`
        : '';
    const synthesizerUser = `Pregunta del usuario: "${message}"

${structuredBlock}Contexto reunido (datos del grafo y código — referencia${useTwoPhase ? '; prioriza el JSON de arriba para citas' : ''}):

${rawContextForSynth || '**sin datos en índice para este alcance** (no hay salidas de herramientas con filas ni archivos leídos). Indícalo sin inventar rutas. Si el índice existe, menciona alcance (repo vs proyecto, scope.repoIds, chat amplio) y graph-summary antes de sugerir solo resync.'}

---
Sintetiza una respuesta clara. Si no hay datos útiles, di explícitamente **sin datos en índice para este alcance**.`;

    let answer: string;
    if (gatheredContext.trim()) {
      answer = await this.llm.callLlm(
        [
          { role: 'system', content: synthesizerSystem },
          { role: 'user', content: synthesizerUser },
        ],
        evidenceFirst ? 3072 : 2048,
      );
    } else {
      answer = emptyRetrieverUserMessage(state);
    }

    const telemetryEnabled = process.env.CHAT_TELEMETRY_LOG === '1' || process.env.CHAT_TELEMETRY_LOG === 'true';
    if (telemetryEnabled) {
      this.logger.log(
        JSON.stringify({
          event: 'codebase_chat_synthesize',
          repositoryId: state.repositoryId,
          projectId: state.projectId,
          answerChars: answer.length,
        }),
      );
    }

    return {
      answer: answer.trim(),
      resultOut: collectedResults.length > 0 ? collectedResults : undefined,
    };
  }
}
