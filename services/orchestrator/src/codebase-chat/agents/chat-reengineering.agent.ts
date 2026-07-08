/**
 * Reengineering agent — modification-plan files + retrieve context + router-tier audit.
 * Skips full analyze-prep (diagnostico + duplicados/embeddings) — that path is for the Analyze UI
 * and often exceeds ingest timeouts on large repos.
 */
import { Injectable } from '@nestjs/common';
import { IngestChatClient } from '../ingest-chat.client';
import { OrchestratorLlmService } from '../orchestrator-llm.service';
import type { CodebaseChatState } from '../codebase-chat.service';
import type { ModificationPlanResult } from '../ingest-types';

const AUDIT_SYSTEM = `<rol>Arquitecto senior que propone reingeniería brownfield basada SOLO en evidencia del índice.</rol>

<instrucciones>
1. Responde la pregunta del usuario (nuevos medios, desacoplamiento, reglas de negocio).
2. Sección **## Diagnóstico** — acoplamiento actual citando paths/content-types del contexto.
3. Sección **## Propuesta** — arquitectura objetivo (parametrización, plantillas, políticas de venta, adapters).
4. Sección **## Archivos a tocar** — tabla path | repoId | motivo (solo paths del plan o contexto).
5. Sección **## Evidencia** — rutas literales del retrieval y del análisis.
6. Sección **## Riesgos y fases** — migración incremental, quick wins.
</instrucciones>

<restricciones>
- PROHIBIDO inventar paths. Sin evidencia → "(no consta en el índice)".
- En español. 400-900 palabras salvo listados explícitos.
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

    const filesToModify = await this.fetchModificationPlanFiles(state, repositoryId, projectId, message, scope);
    const filesBlock = this.formatFilesBlock(filesToModify);

    const userPrompt = `Pregunta del usuario:\n"${message}"\n\n${filesBlock}\n\n### Contexto del retrieve\n${gatheredContext.slice(0, 14000) || '(vacío — indicar alcance/repo)'}`;

    const answer = await this.llm.callRouterLlm(
      [
        { role: 'system', content: AUDIT_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      4096,
    );

    const header = `> **Agente:** reingeniería (router) · ${filesToModify.length} archivos en plan · intent: arquitectura de dominio\n\n`;
    return { answer: header + answer.trim() };
  }

  private async fetchModificationPlanFiles(
    state: CodebaseChatState,
    repositoryId: string,
    projectId: string,
    message: string,
    scope: CodebaseChatState['scope'],
  ): Promise<ModificationPlanResult['filesToModify']> {
    try {
      return state.projectScope
        ? await this.ingest.fetchModificationPlanFilesProject(projectId, message, scope)
        : await this.ingest.fetchModificationPlanFilesRepository(repositoryId, message, scope);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return [{ path: `(plan no disponible: ${detail})`, repoId: '' }];
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
}
