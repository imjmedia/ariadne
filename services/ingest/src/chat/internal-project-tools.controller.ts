/**
 * API interna por projectId: prep analyze agents/skill y listado de archivos del modification-plan.
 */
import { Body, Controller, Param, Post } from '@nestjs/common';
import {
  ChatService,
  type AnalyzeOrchestratorPrepDto,
  type ChatScope,
} from './chat.service';

@Controller('internal/projects')
export class InternalProjectToolsController {
  constructor(private readonly chat: ChatService) {}

  @Post(':projectId/analyze-prep')
  async analyzePrep(
    @Param('projectId') projectId: string,
    @Body() body: { mode: 'agents' | 'skill' },
  ): Promise<AnalyzeOrchestratorPrepDto> {
    return this.chat.prepareAnalyzeByProjectOrchestrator(projectId, body.mode);
  }

  @Post(':projectId/modification-plan-files')
  async modificationPlanFiles(
    @Param('projectId') projectId: string,
    @Body() body: { userDescription: string; scope?: ChatScope; currentFilePath?: string },
  ): Promise<{ filesToModify: Array<{ path: string; repoId: string }> }> {
    const desc = body.userDescription?.trim() ?? '';
    if (!desc) return { filesToModify: [] };
    return {
      filesToModify: await this.chat.getModificationPlanFilesOnlyByProject(
        projectId,
        desc,
        body.scope,
        body.currentFilePath?.trim() || null,
      ),
    };
  }

  /** Cruce endpoints Strapi vs consumidores (evita LangGraph cuando orchestrator delega aquí). */
  @Post(':projectId/unused-api-endpoints')
  async unusedApiEndpoints(
    @Param('projectId') projectId: string,
    @Body() body: { scope?: ChatScope },
  ): Promise<{ answer: string; cypher?: string; result?: unknown[] }> {
    return this.chat.buildUnusedApiEndpointsAnalysis(projectId, body.scope);
  }
}
