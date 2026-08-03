/**
 * @fileoverview Promote Ariadne chat conversation to The Forge stage (orchestration).
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryDeepPartialEntity, Repository } from 'typeorm';
import type { CredentialActor } from '../credentials/credential-actor';
import { ChatConversationEntity } from '../chat/entities/chat-conversation.entity';
import { ChatMessageEntity } from '../chat/entities/chat-message.entity';
import { ProjectEntity } from '../projects/entities/project.entity';
import { RepositoryEntity } from '../repositories/entities/repository.entity';
import { ChangePromotionPackService } from './change-promotion-pack.service';
import type { ChangePromotionPackV1, ForgeDeliverableKind } from './change-promotion-pack.types';
import {
  ForgeResolveAmbiguousError,
  ForgeResolveNotFoundError,
  type ResolveForgeProjectResult,
} from './change-promotion-pack.types';
import { CursorTasksDocumentService } from './cursor-tasks-document.service';
import { FORGE_PROMOTION_PENDING_TTL_MS } from './forge-timeout.constants';
import {
  forgePromotionProgressPatch,
  type ForgePromotionPhase,
} from './forge-promotion-progress.util';
import {
  forgePreviewProgressPatch,
  type ForgePreviewPhase,
  type ForgePreviewStatus,
} from './forge-preview-progress.util';
import { TheForgeClient } from './theforge-client.service';
import { TheForgeIntegrationService } from './theforge-integration.service';

export type ForgePromotionStatus = 'none' | 'pending' | 'success' | 'failed';

export interface ForgePromotionStateDto {
  status: ForgePromotionStatus;
  forgeProjectId: string | null;
  forgeStageId: string | null;
  promotedAt: string | null;
  lastError: string | null;
  stageUrl: string | null;
  idempotencyKey: string | null;
  phase: string | null;
  percent: number | null;
  previewStatus: ForgePreviewStatus;
  previewPhase: string | null;
  previewPercent: number | null;
  previewLastError: string | null;
}

export interface PromoteToTheForgeBody {
  stageName: string;
  stageKey?: string;
  deliverables: ForgeDeliverableKind[];
  activate?: boolean;
  forgeProjectId?: string;
}

export type PromoteToTheForgeResult = { status: 'pending' };

export type PreviewToTheForgeResult = { status: 'pending' };

@Injectable()
export class TheForgePromotionService {
  private readonly logger = new Logger(TheForgePromotionService.name);

  constructor(
    @InjectRepository(ChatConversationEntity)
    private readonly conversations: Repository<ChatConversationEntity>,
    @InjectRepository(ChatMessageEntity)
    private readonly messages: Repository<ChatMessageEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(RepositoryEntity)
    private readonly repositories: Repository<RepositoryEntity>,
    private readonly packService: ChangePromotionPackService,
    private readonly cursorTasks: CursorTasksDocumentService,
    private readonly forgeClient: TheForgeClient,
    private readonly integration: TheForgeIntegrationService,
  ) {}

  async isPromoteEnabled(): Promise<boolean> {
    return this.integration.isChatPromotionAvailable();
  }

  private async assertChatPromotionAvailable(): Promise<void> {
    if (!(await this.isPromoteEnabled())) {
      throw new ServiceUnavailableException({
        code: 'FORGE_NOT_CONFIGURED',
        message:
          'The Forge no está configurado. Es una integración opcional: actívala en Ajustes (admin) si la usas.',
      });
    }
  }

  async getPromotionState(actor: CredentialActor, conversationId: string): Promise<ForgePromotionStateDto> {
    const row = await this.getOwnedConversation(actor, conversationId);
    return this.toStateDto(row);
  }

  async previewPack(
    actor: CredentialActor,
    conversationId: string,
    body: Partial<PromoteToTheForgeBody>,
  ): Promise<PreviewToTheForgeResult> {
    await this.assertChatPromotionAvailable();
    const conversation = await this.getOwnedConversation(actor, conversationId);
    await this.clearStalePendingPreview(conversation);
    this.normalizeDeliverables(body.deliverables);

    await this.updateConversation(conversationId, {
      forgePreviewStatus: 'pending',
      forgePreviewLastError: null,
      forgePreviewResult: null,
      ...forgePreviewProgressPatch('pack_build'),
    });

    void this.runPreviewConversationJob(conversationId, body).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`previewPack ${conversationId} background job crashed: ${message}`);
    });

    return { status: 'pending' };
  }

  async getPreviewResult(actor: CredentialActor, conversationId: string) {
    const row = await this.getOwnedConversation(actor, conversationId);
    if (row.forgePreviewStatus !== 'success' || !row.forgePreviewResult) {
      throw new BadRequestException('No hay vista previa lista para esta conversación.');
    }
    return row.forgePreviewResult;
  }

  private async runPreviewConversationJob(
    conversationId: string,
    body: Partial<PromoteToTheForgeBody>,
  ): Promise<void> {
    try {
      await this.updateConversationPreviewPhase(conversationId, 'pack_build');

      const deliverables = this.normalizeDeliverables(body.deliverables);
      const preview = await this.packService.buildPreview({
        conversationId,
        stageName: body.stageName,
        stageKey: body.stageKey,
        deliverablesRequested: deliverables,
      });
      const linkedForge = await this.findLinkedForgeProject(
        preview.pack.ariadne.projectId,
        preview.pack.ariadne.repositoryId,
      );

      const result = {
        preview: {
          changeTitle: preview.changeTitle,
          stageKeySuggested: preview.stageKeySuggested,
          userDescription: preview.userDescription,
          hasMermaid: preview.hasMermaid,
          erDiagramPreview: preview.erDiagramPreview,
          modificationPlanFileCount: preview.modificationPlanFileCount,
          modificationPlanSample: preview.modificationPlanSample,
          indexFresh: preview.indexFresh,
          indexStaleHours: preview.indexStaleHours,
          warnings: preview.warnings,
          messageCount: preview.messageCount,
        },
        linkedForgeProject: linkedForge,
        promoteEnabled: await this.isPromoteEnabled(),
      };

      await this.updateConversation(conversationId, {
        forgePreviewStatus: 'success',
        forgePreviewLastError: null,
        ...forgePreviewProgressPatch('done'),
      });
      const fresh = await this.conversations.findOne({ where: { id: conversationId } });
      if (fresh) {
        fresh.forgePreviewResult = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
        await this.conversations.save(fresh);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`previewPack ${conversationId} failed: ${message}`);
      await this.updateConversation(conversationId, {
        forgePreviewStatus: 'failed',
        forgePreviewLastError: message,
        forgePreviewResult: null,
        ...forgePreviewProgressPatch('failed'),
      });
    }
  }

  private async clearStalePendingPreview(conversation: ChatConversationEntity): Promise<void> {
    if (conversation.forgePreviewStatus !== 'pending') return;
    const ageMs = Date.now() - conversation.updatedAt.getTime();
    if (ageMs < FORGE_PROMOTION_PENDING_TTL_MS) {
      throw new ConflictException('Ya hay una vista previa en curso para esta conversación');
    }
    this.logger.warn(
      `Conversation ${conversation.id} preview pending for ${Math.round(ageMs / 1000)}s — allowing retry`,
    );
    await this.updateConversation(conversation.id, {
      forgePreviewStatus: 'failed',
      forgePreviewLastError:
        'La vista previa anterior no terminó (timeout o error de red). Se permite reintentar.',
      ...forgePreviewProgressPatch('failed'),
    });
    conversation.forgePreviewStatus = 'failed';
  }

  private async updateConversationPreviewPhase(
    conversationId: string,
    phase: ForgePreviewPhase,
  ): Promise<void> {
    await this.updateConversation(conversationId, forgePreviewProgressPatch(phase));
  }

  async promote(
    actor: CredentialActor,
    conversationId: string,
    body: PromoteToTheForgeBody,
  ): Promise<PromoteToTheForgeResult> {
    await this.assertChatPromotionAvailable();
    const conversation = await this.getOwnedConversation(actor, conversationId);
    await this.clearStalePendingPromotion(conversation);

    const messageCount = await this.messages.count({ where: { conversationId } });
    if (messageCount === 0) {
      throw new BadRequestException('La conversación está vacía');
    }

    this.normalizeDeliverables(body.deliverables);

    await this.updateConversation(conversationId, {
      forgePromotionStatus: 'pending',
      forgePromotionLastError: null,
      ...forgePromotionProgressPatch('pack_resolve'),
    });

    void this.runPromoteConversationJob(conversationId, body).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`promote ${conversationId} background job crashed: ${message}`);
    });

    return { status: 'pending' };
  }

  private async runPromoteConversationJob(
    conversationId: string,
    body: PromoteToTheForgeBody,
  ): Promise<void> {
    try {
      await this.updateConversationPhase(conversationId, 'pack_resolve');

      const deliverables = this.normalizeDeliverables(body.deliverables);
      const basePack = await this.packService.build({
        conversationId,
        stageName: body.stageName,
        stageKey: body.stageKey,
        deliverablesRequested: deliverables,
      });

      await this.updateConversationPhase(conversationId, 'pack_enrich');
      const { pack } = await this.cursorTasks.enrichPack(basePack);

      const fresh = await this.conversations.findOne({ where: { id: conversationId } });
      if (
        fresh?.forgePromotionStatus === 'success' &&
        fresh.forgePromotionIdempotencyKey === pack.idempotencyKey &&
        fresh.forgeStageId
      ) {
        await this.updateConversation(conversationId, forgePromotionProgressPatch('done'));
        return;
      }

      const resolved = await this.resolveForgeProjectForPromotion(pack, body.forgeProjectId);

      await this.updateConversationPhase(conversationId, 'forge_create');

      const created = await this.forgeClient.createStageFromChangePack({
        forgeProjectId: resolved.forgeProjectId,
        pack,
        stageName: body.stageName.trim(),
        activate: body.activate ?? false,
        runLegacyStart: pack.modificationPlan.filesToModify.length === 0 ? undefined : false,
        wireAriadne: true,
      });

      await this.updateConversation(conversationId, {
        forgeProjectId: created.forgeProjectId,
        forgeStageId: created.forgeStageId,
        forgeStageUrl: created.stageUrl ?? null,
        forgePromotedAt: new Date(),
        forgePromotionStatus: 'success',
        forgePromotionIdempotencyKey: pack.idempotencyKey,
        forgePromotionLastError: null,
        ...forgePromotionProgressPatch('done'),
      });
    } catch (err) {
      await this.handlePromoteJobFailure(conversationId, err);
    }
  }

  private async handlePromoteJobFailure(conversationId: string, err: unknown): Promise<void> {
    if (err instanceof ForgeResolveAmbiguousError) {
      await this.updateConversation(conversationId, {
        forgePromotionStatus: 'failed',
        forgePromotionLastError: JSON.stringify({
          code: 'FORGE_RESOLVE_AMBIGUOUS',
          message: err.message,
          candidates: err.candidates,
        }),
        ...forgePromotionProgressPatch('failed'),
      });
      return;
    }

    if (err instanceof ForgeResolveNotFoundError) {
      await this.updateConversation(conversationId, {
        forgePromotionStatus: 'failed',
        forgePromotionLastError: err.message,
        ...forgePromotionProgressPatch('failed'),
      });
      return;
    }

    const message = err instanceof Error ? err.message : String(err);
    this.logger.warn(`promote ${conversationId} failed: ${message}`);
    await this.updateConversation(conversationId, {
      forgePromotionStatus: 'failed',
      forgePromotionLastError: message,
      ...forgePromotionProgressPatch('failed'),
    });
  }

  private async clearStalePendingPromotion(conversation: ChatConversationEntity): Promise<void> {
    if (conversation.forgePromotionStatus !== 'pending') return;
    const ageMs = Date.now() - conversation.updatedAt.getTime();
    if (ageMs < FORGE_PROMOTION_PENDING_TTL_MS) {
      throw new ConflictException('Ya hay una promoción en curso para esta conversación');
    }
    this.logger.warn(
      `Conversation ${conversation.id} promotion pending for ${Math.round(ageMs / 1000)}s — allowing retry`,
    );
    await this.updateConversation(conversation.id, {
      forgePromotionStatus: 'failed',
      forgePromotionLastError:
        'La promoción anterior no terminó (timeout o error de red). Se permite reintentar.',
      ...forgePromotionProgressPatch('failed'),
    });
    conversation.forgePromotionStatus = 'failed';
  }

  private async updateConversationPhase(
    conversationId: string,
    phase: ForgePromotionPhase,
  ): Promise<void> {
    await this.updateConversation(conversationId, forgePromotionProgressPatch(phase));
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

  private async resolveForgeProjectForPromotion(
    pack: ChangePromotionPackV1,
    explicitForgeProjectId?: string,
  ): Promise<ResolveForgeProjectResult> {
    const trimmed = explicitForgeProjectId?.trim();
    if (trimmed) {
      return {
        forgeProjectId: trimmed,
        forgeProjectName: trimmed,
        linkKind: 'primary',
        warnings: [],
      };
    }

    const linked = await this.findLinkedForgeProject(
      pack.ariadne.projectId,
      pack.ariadne.repositoryId,
    );
    if (linked) {
      return linked;
    }

    return this.forgeClient.resolveProjectForAriadne({
      ariadneProjectId: pack.ariadne.projectId,
      ariadneRepositoryId: pack.ariadne.repositoryId ?? undefined,
      projectKey: pack.ariadne.projectKey ?? undefined,
      repoSlug: pack.ariadne.repoSlug ?? undefined,
    });
  }

  private async findLinkedForgeProject(
    ariadneProjectId: string,
    ariadneRepositoryId?: string | null,
  ): Promise<ResolveForgeProjectResult | null> {
    const project = await this.projects.findOne({
      where: { id: ariadneProjectId },
      select: ['id', 'theforgeProjectId', 'theforgeProjectName'],
    });
    if (project) {
      const projectForgeId = project.theforgeProjectId?.trim();
      if (projectForgeId) {
        return {
          forgeProjectId: projectForgeId,
          forgeProjectName: project.theforgeProjectName?.trim() || projectForgeId,
          linkKind: 'primary',
          warnings: [],
        };
      }
    }

    const repoId = ariadneRepositoryId?.trim();
    if (!repoId) return null;

    const repo = await this.repositories.findOne({
      where: { id: repoId },
      select: ['id', 'theforgeProjectId', 'projectKey', 'repoSlug'],
    });
    if (!repo) return null;

    const repoForgeId = repo.theforgeProjectId?.trim();
    if (!repoForgeId) return null;

    return {
      forgeProjectId: repoForgeId,
      forgeProjectName:
        repo.projectKey && repo.repoSlug
          ? `${repo.projectKey}/${repo.repoSlug}`
          : repoForgeId,
      linkKind: 'primary',
      warnings: [],
    };
  }

  private toStateDto(row: ChatConversationEntity): ForgePromotionStateDto {
    const status = (row.forgePromotionStatus ?? 'none') as ForgePromotionStatus;
    return {
      status,
      forgeProjectId: row.forgeProjectId,
      forgeStageId: row.forgeStageId,
      promotedAt: row.forgePromotedAt?.toISOString() ?? null,
      lastError: row.forgePromotionLastError,
      stageUrl: row.forgeStageUrl,
      idempotencyKey: row.forgePromotionIdempotencyKey,
      phase: row.forgePromotionPhase,
      percent: row.forgePromotionPercent,
      previewStatus: (row.forgePreviewStatus ?? 'none') as ForgePreviewStatus,
      previewPhase: row.forgePreviewPhase,
      previewPercent: row.forgePreviewPercent,
      previewLastError: row.forgePreviewLastError,
    };
  }

  private async getOwnedConversation(
    actor: CredentialActor,
    conversationId: string,
  ): Promise<ChatConversationEntity> {
    if (!actor.userId) {
      throw new ForbiddenException('Usuario no identificado');
    }
    const row = await this.conversations.findOne({ where: { id: conversationId } });
    if (!row) throw new NotFoundException('Conversación no encontrada');
    if (row.userId !== actor.userId) {
      throw new ForbiddenException('No tienes acceso a esta conversación');
    }
    return row;
  }

  private async updateConversation(
    conversationId: string,
    patch: QueryDeepPartialEntity<ChatConversationEntity>,
  ): Promise<void> {
    await this.conversations.update(conversationId, patch);
  }
}
