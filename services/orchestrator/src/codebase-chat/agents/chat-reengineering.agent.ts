/**
 * Reengineering agent — analyze prep + modification-plan files + retrieve + router-tier audit.
 */
import { Injectable } from '@nestjs/common';
import type { ChatScope } from '../chat-scope.util';
import { IngestChatClient } from '../ingest-chat.client';
import { OrchestratorLlmService } from '../orchestrator-llm.service';
import type { CodebaseChatState } from '../codebase-chat.service';

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

    const [analyzePrep, filesToModify] = await Promise.all([
      this.ingest.fetchAnalyzePrepRepository(repositoryId, 'reingenieria'),
      state.projectScope
        ? this.ingest.fetchModificationPlanFilesProject(projectId, message, scope)
        : this.ingest.fetchModificationPlanFilesRepository(repositoryId, message, scope),
    ]);

    const analyzeBlock =
      analyzePrep.kind === 'llm'
        ? `### Datos de análisis (reingeniería)\n${analyzePrep.userPrompt.slice(0, 12000)}`
        : `### Análisis completo\n${analyzePrep.result.summary?.slice(0, 8000) ?? ''}`;

    const filesBlock =
      filesToModify.length > 0
        ? `### Archivos sugeridos (${filesToModify.length})\n${filesToModify
            .slice(0, 80)
            .map((f) => `- \`${f.path}\`${f.repoId ? ` (repo: ${f.repoId})` : ''}`)
            .join('\n')}`
        : '### Archivos sugeridos\n(sin rutas en el plan para este alcance)';

    const userPrompt = `Pregunta del usuario:\n"${message}"\n\n${analyzeBlock}\n\n${filesBlock}\n\n### Contexto del retrieve\n${gatheredContext.slice(0, 14000) || '(vacío — indicar alcance/repo)'}`;

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
}
