/**
 * Integration handoff agent — multi-query plan + semantic context + AC-driven audit.
 * For NEW-LEG handoffs imported from The Forge (not generic brownfield reengineering).
 */
import { Injectable } from '@nestjs/common';
import type { ParsedIntegrationHandoff } from 'ariadne-common';
import {
  buildIntegrationHandoffSearchQueries,
  parseIntegrationHandoffMessage,
} from 'ariadne-common';
import { IngestChatClient } from '../ingest-chat.client';
import { OrchestratorLlmService } from '../orchestrator-llm.service';
import type { CodebaseChatState } from '../codebase-chat.service';
import type { ModificationPlanResult } from '../ingest-types';

const AUDIT_SYSTEM = `<rol>Analista senior de integración NEW→LEG sobre código brownfield indexado en Ariadne.</rol>

<instrucciones>
1. Interpreta el handoff: actor, necesidad de negocio, dependencia del sistema NEW vs cambios en LEG.
2. **## Resumen del handoff** — id, título, origen NEW, actor (del texto).
3. **## Mapeo UX (puntos de entrada)** — rutas/flujo usuario (p. ej. catálogo → previsualizador). NO asumas un solo tipo de medio si el handoff habla de catálogo o medios en general.
4. **## Archivos LEG a tocar** — tabla Markdown: **path | repoId | qué modificar | criterio AC**.
5. **## Referencia visual existente** — dónde el LEG ya muestra algo similar (p. ej. costos en pauta) citando paths del plan/contexto.
6. **## Contrato NEW** — qué debe exponer el microservicio NEW y qué consumirá el front LEG (params, shape); sin inventar endpoints no mencionados.
7. **## Criterios de aceptación** — checklist numerado; por cada AC: ✅ cubierto / ⚠️ gap con explicación.
8. **## Riesgos y fases** — migración incremental, quick wins, feature flag si aplica.
</instrucciones>

<restricciones>
- PROHIBIDO inventar paths. Sin evidencia → "(no consta en el índice)".
- Si el plan solo lista archivos de UN módulo (ej. DataCamiones) pero el handoff pide catálogo transversal, **decláralo como gap** y lista qué otros entry points habría que confirmar.
- Distingue cambios LEG (UI/API cliente) de responsabilidad NEW (microservicio origen).
- En español. 500-1000 palabras salvo tablas.
- NO generes el bloque JSON ChangePlan — el sistema lo añade automáticamente.
</restricciones>`;

@Injectable()
export class ChatIntegrationHandoffAgent {
  constructor(
    private readonly ingest: IngestChatClient,
    private readonly llm: OrchestratorLlmService,
  ) {}

  async runAudit(state: CodebaseChatState): Promise<{ answer: string }> {
    const parsed = parseIntegrationHandoffMessage(state.message);
    const plan = await this.fetchIntegrationHandoffPlan(state, state.message);
    const semanticBlock = await this.gatherSemanticContext(state, parsed, state.message);
    const filesBlock = this.formatFilesBlock(plan.filesToModify);
    const evidenceBlock = this.formatEvidenceBlock(plan);
    const handoffBlock = this.formatHandoffBlock(parsed);
    const warningsBlock = this.formatWarningsBlock(plan);

    const userPrompt = [
      `Handoff / mensaje del usuario:\n"${state.message.slice(0, 12000)}"`,
      handoffBlock,
      warningsBlock,
      filesBlock,
      evidenceBlock,
      semanticBlock,
      `### Contexto retrieve previo\n${(state.gatheredContext ?? '').slice(0, 8000) || '(vacío)'}`,
    ].join('\n\n');

    const answer = await this.llm.callRouterLlm(
      [
        { role: 'system', content: AUDIT_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      4096,
    );

    const fileCount = plan.filesToModify.length;
    const handoffId = parsed?.handoffId ?? state.integrationHandoffId ?? 'NEW-LEG';
    const header = `> **Agente:** integración handoff · ${fileCount} archivos en plan · \`${handoffId}\`\n\n`;
    const appendix = this.formatChangePlanAppendix(plan, state.projectId, state.message);
    return { answer: header + answer.trim() + appendix };
  }

  private async fetchIntegrationHandoffPlan(
    state: CodebaseChatState,
    message: string,
  ): Promise<ModificationPlanResult> {
    try {
      return state.projectScope
        ? await this.ingest.fetchIntegrationHandoffPlanProject(state.projectId, message, state.scope)
        : await this.ingest.fetchIntegrationHandoffPlanRepository(
            state.repositoryId,
            message,
            state.scope,
          );
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return {
        filesToModify: [{ path: `(plan handoff no disponible: ${detail})`, repoId: '' }],
        questionsToRefine: [],
      };
    }
  }

  private async gatherSemanticContext(
    state: CodebaseChatState,
    parsed: ParsedIntegrationHandoff | null,
    fullMessage: string,
  ): Promise<string> {
    if (!parsed) return '### Búsqueda semántica adicional\n(no parseado como handoff estructurado)';
    const queries = buildIntegrationHandoffSearchQueries(parsed, fullMessage).slice(0, 4);
    const lines: string[] = ['### Búsqueda semántica adicional'];
    for (const q of queries) {
      try {
        const r = await this.ingest.executeRetrieverTool(state.repositoryId, {
          projectScope: state.projectScope,
          scope: state.scope,
          tool: 'semantic_search',
          arguments: { query: q, limit: 8 },
          fallbackMessage: q,
        });
        const snippet = (r.toolResult ?? '').slice(0, 1200);
        lines.push(`**Query:** ${q}\n${snippet || '(sin resultados)'}`);
      } catch {
        lines.push(`**Query:** ${q}\n(error en semantic_search)`);
      }
    }
    return lines.join('\n\n');
  }

  private formatHandoffBlock(parsed: ParsedIntegrationHandoff | null): string {
    if (!parsed) return '### Handoff parseado\n(no estructurado — tratar mensaje completo)';
    const ac =
      parsed.acceptanceCriteria.length > 0
        ? parsed.acceptanceCriteria.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')
        : '(sin AC explícitos)';
    return [
      '### Handoff parseado',
      `- **Id:** ${parsed.handoffId ?? '—'}`,
      `- **Título:** ${parsed.title ?? '—'}`,
      `- **Origen NEW:** ${parsed.sourceProject ?? '—'}`,
      `- **Actor:** ${parsed.actor ?? '—'}`,
      `- **Criterios de aceptación:**\n${ac}`,
    ].join('\n');
  }

  private formatWarningsBlock(plan: ModificationPlanResult): string {
    if (!plan.warnings?.length) return '';
    return `### Advertencias del plan\n${plan.warnings.map((w) => `- ${w}`).join('\n')}`;
  }

  private formatFilesBlock(filesToModify: ModificationPlanResult['filesToModify']): string {
    if (filesToModify.length === 0) {
      return '### Archivos sugeridos (plan handoff)\n(sin rutas — revisar sync/alcance)';
    }
    const lines = filesToModify
      .slice(0, 80)
      .map((f) => `- \`${f.path}\`${f.repoId ? ` (repo: ${f.repoId})` : ''}`)
      .join('\n');
    return `### Archivos sugeridos (${filesToModify.length})\n${lines}`;
  }

  private formatEvidenceBlock(plan: ModificationPlanResult): string {
    const bundle = plan.graphEvidenceBundle as
      | { files?: Array<{ path: string; symbols?: string[]; dependents?: Array<{ symbol: string; count: number }> }> }
      | undefined;
    if (!bundle?.files?.length) return '### Evidencia de grafo\n(no disponible)';
    const lines = bundle.files.slice(0, 25).map((f) => {
      const syms = (f.symbols ?? []).slice(0, 4).join(', ') || '—';
      return `- \`${f.path}\` · símbolos: ${syms}`;
    });
    return `### Evidencia de grafo\n${lines.join('\n')}`;
  }

  private formatChangePlanAppendix(
    plan: ModificationPlanResult,
    projectId: string,
    message: string,
  ): string {
    const template =
      plan.changePlanTemplate ??
      ({
        schemaVersion: '1.0',
        source: 'mcp',
        projectId,
        changeDescription: message,
        referencePlan: { filesToModify: plan.filesToModify },
        files: plan.filesToModify.map((f) => ({
          path: f.path,
          repoId: f.repoId,
          changeType: 'modify',
          symbols: [],
        })),
        tasks: [],
      } as Record<string, unknown>);

    return (
      '\n\n---\n\n## ChangePlan (máquina)\n\n' +
      '```json\n' +
      JSON.stringify(template, null, 2) +
      '\n```\n'
    );
  }
}
