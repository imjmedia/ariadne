/**
 * @fileoverview Rutas de chat/análisis por projectId (multi-root). Delega en ChatService.
 */
import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  InternalServerErrorException,
  Post,
  Param,
} from '@nestjs/common';
import {
  ChatService,
  type AnalyzeMode,
  type AnalyzeRequestOptions,
  type ChatRequest,
  type ChatResponse,
  type ChatScope,
  type ModificationPlanResult,
  type ModificationPlanQuestionsMode,
  type AnalyzeResult,
} from './chat.service';
import { AnalyticsService } from './analytics.service';
import { ChangePlanValidationService } from '../plan-validation/change-plan-validation.service';
import type { ChangePlan } from '../plan-validation/change-plan-validation.types';
import type { PlanValidationReport } from '../plan-validation/change-plan-validation.types';
import { changePlanFromForgeTasksJson } from '../plan-validation/forge-tasks-json.mapper';

@Controller('projects')
export class ProjectChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly analyticsService: AnalyticsService,
    private readonly planValidation: ChangePlanValidationService,
  ) {}

  /**
   * Análisis por proyecto:
   * - `mode`: `agents` | `skill` → AGENTS.md / SKILL.md (comportamiento previo).
   * - `mode`: `diagnostico` | `duplicados` | … → resuelve `repositoryId` (mono-root, o multi-root con `idePath` / `repositoryId`) y delega en el mismo pipeline que `POST /repositories/:id/analyze`.
   */
  @Post(':projectId/analyze')
  async analyze(
    @Param('projectId') projectId: string,
    @Body()
    body: {
      mode?: AnalyzeMode;
      idePath?: string;
      repositoryId?: string;
      scope?: ChatScope;
      crossPackageDuplicates?: boolean;
    },
  ): Promise<AnalyzeResult> {
    const mode = (body?.mode ?? 'agents') as AnalyzeMode;
    try {
      if (mode === 'agents' || mode === 'skill') {
        return await this.chatService.analyzeByProject(projectId, mode);
      }
      if (!this.analyticsService.isCodeAnalysisMode(mode)) {
        throw new BadRequestException(`Modo de análisis no soportado en esta ruta: ${String(mode)}`);
      }
      const analyzeOpts: AnalyzeRequestOptions | undefined =
        body?.scope || body?.crossPackageDuplicates
          ? {
              ...(body.scope ? { scope: body.scope } : {}),
              ...(body.crossPackageDuplicates ? { crossPackageDuplicates: true } : {}),
            }
          : undefined;
      return await this.analyticsService.analyzeByProjectId(projectId, mode, {
        idePath: body?.idePath,
        repositoryId: body?.repositoryId,
        analyzeOptions: analyzeOpts,
      });
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      const hint = msg.includes('API key') || msg.includes('Ajustes')
        ? ' Guarda la API key en Ajustes → Proveedores IA.'
        : msg.includes('connect') || msg.includes('ECONNREFUSED')
          ? ' Verifica que FalkorDB esté corriendo.'
          : '';
      throw new InternalServerErrorException(msg + hint);
    }
  }

  /** Chat a nivel proyecto: grafo de todos los repos del proyecto; get_file_content busca en cualquier repo. */
  @Post(':projectId/chat')
  async chat(
    @Param('projectId') projectId: string,
    @Body() body: ChatRequest,
  ): Promise<ChatResponse> {
    return this.chatService.chatByProject(projectId, body);
  }

  /**
   * Plan de modificación: multi-root vía `scope.repoIds` / `currentFilePath` / un solo repo; ver `modification-plan-resolve.util.ts`.
   */
  @Post(':projectId/modification-plan')
  async getModificationPlan(
    @Param('projectId') projectId: string,
    @Body()
    body: {
      userDescription: string;
      scope?: ChatScope;
      currentFilePath?: string;
      questionsMode?: ModificationPlanQuestionsMode;
    },
  ): Promise<ModificationPlanResult> {
    const userDescription = body?.userDescription?.trim() ?? '';
    if (!userDescription) {
      return {
        filesToModify: [],
        questionsToRefine: [],
        diagnostic: {
          code: 'MISSING_USER_DESCRIPTION',
          message: 'Se requiere userDescription (texto no vacío).',
        },
      };
    }
    return this.chatService.getModificationPlanByProject(
      projectId,
      userDescription,
      body?.scope,
      body?.currentFilePath?.trim() || null,
      body?.questionsMode,
    );
  }

  /**
   * Gate 2: validates a structured ChangePlan (The Forge / Cursor) against FalkorDB.
   */
  @Post(':projectId/validate-change-plan')
  async validateChangePlan(
    @Param('projectId') projectId: string,
    @Body() body: ChangePlan,
  ): Promise<PlanValidationReport> {
    return this.planValidation.validate(projectId, body);
  }

  /**
   * Post-deliverable Gate 2: map Forge tasksJson → ChangePlan and validate.
   * Forge MUST call this after legacy_generate_deliverables when migration_tasks was requested.
   * If verdict === BLOCKED, do not accept the tasks deliverable.
   */
  @Post(':projectId/validate-tasks-json')
  async validateTasksJson(
    @Param('projectId') projectId: string,
    @Body()
    body: {
      tasksJson?: unknown;
      tasks?: unknown;
      changeDescription?: string;
    },
  ): Promise<PlanValidationReport & { changePlan?: ChangePlan }> {
    const raw = body?.tasksJson ?? body?.tasks ?? body;
    try {
      const plan = changePlanFromForgeTasksJson(projectId, raw, {
        changeDescription: body?.changeDescription,
        source: 'theforge',
      });
      const report = await this.planValidation.validate(projectId, plan);
      return { ...report, changePlan: plan };
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Invalid tasksJson payload',
      );
    }
  }
}
