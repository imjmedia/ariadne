/**
 * Reengineering agent — modification-plan files + retrieve context + router-tier audit.
 * Skips full analyze-prep (diagnostico + duplicados/embeddings) — that path is for the Analyze UI
 * and often exceeds ingest timeouts on large repos.
 *
 * Emits markdown audit + a machine-readable ChangePlan JSON appendix (no second LLM pass).
 */
import { Injectable } from '@nestjs/common';
import { IngestChatClient } from '../ingest-chat.client';
import { OrchestratorLlmService } from '../orchestrator-llm.service';
import type { CodebaseChatState } from '../codebase-chat.service';
import type { ModificationPlanResult } from '../ingest-types';

const AUDIT_SYSTEM = `<rol>Arquitecto senior que propone reingeniería brownfield basada SOLO en evidencia del índice.</rol>

<instrucciones>
1. Responde la pregunta del usuario (nuevos medios, desacoplamiento, reglas de negocio).
2. Sección **## Diagnóstico** — acoplamiento actual citando paths/símbolos/dependents del contexto.
3. Sección **## Propuesta** — arquitectura objetivo anclada a patrones que YA existen en el índice.
4. Sección **## Archivos a tocar** — tabla Markdown con columnas **path | repoId | qué tocar/modificar | símbolo** (solo paths del plan o contexto). La columna **qué tocar/modificar** es obligatoria: describe el cambio concreto en ese archivo (no repetir solo el path).
5. Sección **## Evidencia** — rutas y símbolos literales del retrieval y del plan.
6. Sección **## Riesgos y fases** — migración incremental, quick wins.
7. Por cada cambio propuesto, cita al menos un símbolo indexado y su conteo de dependents si consta.
</instrucciones>

<restricciones>
- PROHIBIDO inventar paths. Sin evidencia → "(no consta en el índice)".
- PROHIBIDO proponer carpetas nuevas tipo \`policies/\`, \`adapters/\`, \`services/\`, \`domain/\` salvo que el bloque "Patrones de carpeta en índice" liste ese patrón con paths de ejemplo.
- Si no hay patrón similar, preferir extracción local (mismo directorio / archivo vecino) frente a capas inventadas.
- En español. 400-900 palabras salvo listados explícitos.
- NO generes el bloque JSON ChangePlan — el sistema lo añade automáticamente.
</restricciones>`;

@Injectable()
export class ChatReengineeringAgent {
  constructor(
    private readonly ingest: IngestChatClient,
    private readonly llm: OrchestratorLlmService,
  ) {}

  async runAudit(state: CodebaseChatState): Promise<{ answer: string }> {
    const repositoryId = state.repositoryId;
    const projectId = state.projectId;
    const scope = state.scope;
    const message = state.message;
    const gatheredContext = state.gatheredContext ?? '';

    const plan = await this.fetchModificationPlan(state, repositoryId, projectId, message, scope);
    const filesToModify = plan.filesToModify;
    const filesBlock = this.formatFilesBlock(filesToModify);
    const evidenceBlock = this.formatEvidenceBlock(plan);
    const layerBlock = this.formatLayerHintFromEvidence(plan);

    const userPrompt = `Pregunta del usuario:\n"${message}"\n\n${filesBlock}\n\n${evidenceBlock}\n\n${layerBlock}\n\n### Contexto del retrieve\n${gatheredContext.slice(0, 14000) || '(vacío — indicar alcance/repo)'}`;

    const answer = await this.llm.callRouterLlm(
      [
        { role: 'system', content: AUDIT_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      4096,
    );

    const header = `> **Agente:** reingeniería (router) · ${filesToModify.length} archivos en plan · intent: arquitectura de dominio\n\n`;
    const appendix = this.formatChangePlanAppendix(plan, projectId, message);
    return { answer: header + answer.trim() + appendix };
  }

  private async fetchModificationPlan(
    state: CodebaseChatState,
    repositoryId: string,
    projectId: string,
    message: string,
    scope: CodebaseChatState['scope'],
  ): Promise<ModificationPlanResult> {
    try {
      return state.projectScope
        ? await this.ingest.fetchModificationPlanProject(projectId, message, scope)
        : await this.ingest.fetchModificationPlanRepository(repositoryId, message, scope);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return {
        filesToModify: [{ path: `(plan no disponible: ${detail})`, repoId: '' }],
        questionsToRefine: [],
      };
    }
  }

  private formatFilesBlock(filesToModify: ModificationPlanResult['filesToModify']): string {
    if (filesToModify.length === 0) {
      return '### Archivos sugeridos\n(sin rutas en el plan para este alcance)';
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
      const deps = (f.dependents ?? [])
        .slice(0, 2)
        .map((d) => `${d.symbol}:${d.count}`)
        .join(', ');
      return `- \`${f.path}\` · símbolos: ${syms}${deps ? ` · dependents: ${deps}` : ''}`;
    });
    return `### Evidencia de grafo\n${lines.join('\n')}`;
  }

  private formatLayerHintFromEvidence(plan: ModificationPlanResult): string {
    const paths = plan.filesToModify.map((f) => f.path);
    const patterns = ['/policies/', '/adapters/', '/services/', '/domain/', '/use-cases/'];
    const hits = patterns.filter((p) => paths.some((path) => path.includes(p)));
    if (hits.length === 0) {
      return '### Patrones de carpeta en índice\n(ninguno de policies/adapters/services/domain en el plan — NO inventar esas capas)';
    }
    return `### Patrones de carpeta en índice\nPermitidos por evidencia del plan: ${hits.join(', ')}`;
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
