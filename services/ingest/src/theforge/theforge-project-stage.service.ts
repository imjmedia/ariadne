/**
 * Create The Forge stage from a linked Ariadne project (modifications flow).
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CredentialActor } from '../credentials/credential-actor';
import { ProjectEntity } from '../projects/entities/project.entity';
import {
  ChangePromotionPackService,
  type BuildProjectChangePromotionPackOptions,
} from './change-promotion-pack.service';
import type { ForgeDeliverableKind } from './change-promotion-pack.types';
import { CursorTasksDocumentService } from './cursor-tasks-document.service';
import { TheForgeClient } from './theforge-client.service';
import { TheForgeIntegrationService } from './theforge-integration.service';

export interface ProjectTheForgeStageBody {
  stageName: string;
  changeDescription: string;
  stageKey?: string;
  conversationId?: string;
  deliverables?: ForgeDeliverableKind[];
  activate?: boolean;
}

export interface ProjectTheForgeStagePreview {
  stageName: string;
  stageKeySuggested: string;
  changeDescription: string;
  changeWorkDescription: string;
  cursorTasksMarkdown: string;
  cursorTasksSource: 'llm' | 'fallback';
  modificationPlanFileCount: number;
  modificationPlanSample: string[];
  indexFresh: boolean;
  indexStaleHours: number | null;
  warnings: string[];
  forgeProjectId: string;
  forgeProjectName: string | null;
}

@Injectable()
export class TheForgeProjectStageService {
  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projects: Repository<ProjectEntity>,
    private readonly packService: ChangePromotionPackService,
    private readonly cursorTasks: CursorTasksDocumentService,
    private readonly forgeClient: TheForgeClient,
    private readonly integration: TheForgeIntegrationService,
  ) {}

  private async assertAvailable(): Promise<void> {
    if (!(await this.integration.isChatPromotionAvailable())) {
      throw new ServiceUnavailableException({
        code: 'FORGE_NOT_CONFIGURED',
        message:
          'The Forge no está configurado. Es una integración opcional: actívala en Ajustes (admin) si la usas.',
      });
    }
  }

  private async getLinkedProject(projectId: string): Promise<ProjectEntity> {
    const project = await this.projects.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    const forgeId = project.theforgeProjectId?.trim();
    if (!forgeId) {
      throw new BadRequestException({
        code: 'FORGE_NOT_LINKED',
        message: 'Este proyecto no está vinculado a The Forge. Vincúlalo antes de crear una etapa.',
      });
    }
    return project;
  }

  private normalizeDeliverables(input?: ForgeDeliverableKind[]): ForgeDeliverableKind[] {
    const defaults: ForgeDeliverableKind[] = [
      'change_spec',
      'data_model',
      'modification_plan',
      'migration_tasks',
    ];
    if (!input?.length) return defaults;
    return input;
  }

  private buildPackOptions(
    projectId: string,
    body: ProjectTheForgeStageBody,
  ): BuildProjectChangePromotionPackOptions {
    return {
      projectId,
      changeDescription: body.changeDescription.trim(),
      stageName: body.stageName.trim(),
      stageKey: body.stageKey,
      conversationId: body.conversationId,
      deliverablesRequested: this.normalizeDeliverables(body.deliverables),
    };
  }

  private collectWarnings(
    pack: Awaited<ReturnType<ChangePromotionPackService['buildFromProject']>>,
  ): string[] {
    const warnings: string[] = [];
    if (!pack.ariadne.indexFresh) {
      warnings.push(
        pack.ariadne.indexStaleHours != null
          ? `Índice desactualizado (~${pack.ariadne.indexStaleHours}h). Resync recomendado.`
          : 'Sin fecha de sync conocida.',
      );
    }
    if (pack.modificationPlan.filesToModify.length === 0) {
      warnings.push('Plan de modificación vacío; las tareas serán más genéricas.');
    }
    return warnings;
  }

  async preview(
    actor: CredentialActor,
    projectId: string,
    body: ProjectTheForgeStageBody,
  ): Promise<ProjectTheForgeStagePreview> {
    if (!actor.userId) throw new ForbiddenException('Usuario no identificado');
    await this.assertAvailable();
    const project = await this.getLinkedProject(projectId);

    const pack = await this.packService.buildFromProject(this.buildPackOptions(projectId, body));
    const { pack: enriched, cursorTasksSource } = await this.cursorTasks.enrichPack(pack);

    return {
      stageName: enriched.change.title,
      stageKeySuggested: enriched.change.stageKey,
      changeDescription: enriched.change.userDescription,
      changeWorkDescription: enriched.changeWorkDescription ?? '',
      cursorTasksMarkdown: enriched.cursorTasksMarkdown ?? '',
      cursorTasksSource,
      modificationPlanFileCount: enriched.modificationPlan.filesToModify.length,
      modificationPlanSample: enriched.modificationPlan.filesToModify.slice(0, 8).map((f) => f.path),
      indexFresh: enriched.ariadne.indexFresh,
      indexStaleHours: enriched.ariadne.indexStaleHours,
      warnings: this.collectWarnings(enriched),
      forgeProjectId: project.theforgeProjectId!.trim(),
      forgeProjectName: project.theforgeProjectName,
    };
  }

  async createStage(actor: CredentialActor, projectId: string, body: ProjectTheForgeStageBody) {
    if (!actor.userId) throw new ForbiddenException('Usuario no identificado');
    await this.assertAvailable();
    const project = await this.getLinkedProject(projectId);

    const pack = await this.packService.buildFromProject(this.buildPackOptions(projectId, body));
    const { pack: enriched } = await this.cursorTasks.enrichPack(pack);

    const created = await this.forgeClient.createStageFromChangePack({
      forgeProjectId: project.theforgeProjectId!.trim(),
      pack: enriched,
      stageName: body.stageName.trim(),
      activate: body.activate ?? false,
      runLegacyStart: enriched.modificationPlan.filesToModify.length === 0 ? undefined : false,
      wireAriadne: true,
    });

    return {
      status: 'success' as const,
      forgeProjectId: created.forgeProjectId,
      forgeProjectName: project.theforgeProjectName,
      forgeStageId: created.forgeStageId,
      stageKey: created.stageKey,
      stageName: created.stageName,
      stageUrl: created.stageUrl,
      importMode: created.importMode,
      legacyStart: created.legacyStart,
      ariadneWire: created.ariadneWire,
      recommendedNextTools: created.recommendedNextTools,
      deliverablesCreated: created.deliverablesCreated,
      changeWorkDescription: enriched.changeWorkDescription,
      cursorTasksMarkdown: enriched.cursorTasksMarkdown,
      warnings: this.collectWarnings(enriched),
    };
  }
}
