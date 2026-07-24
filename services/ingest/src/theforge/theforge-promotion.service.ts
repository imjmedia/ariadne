/**
 * @fileoverview Promote Ariadne chat conversation to The Forge stage (orchestration).
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
}

export interface PromoteToTheForgeBody {
  stageName: string;
  stageKey?: string;
  deliverables: ForgeDeliverableKind[];
  activate?: boolean;
  forgeProjectId?: string;
}

@Injectable()
export class TheForgePromotionService {
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

  async previewPack(actor: CredentialActor, conversationId: string, body: Partial<PromoteToTheForgeBody>) {
    await this.assertChatPromotionAvailable();
    await this.getOwnedConversation(actor, conversationId);
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
    return {
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
  }

  async promote(actor: CredentialActor, conversationId: string, body: PromoteToTheForgeBody) {
    await this.assertChatPromotionAvailable();
    const conversation = await this.getOwnedConversation(actor, conversationId);
    if (conversation.forgePromotionStatus === 'pending') {
      throw new ConflictException('Ya hay una promoción en curso para esta conversación');
    }

    const messageCount = await this.messages.count({ where: { conversationId } });
    if (messageCount === 0) {
      throw new BadRequestException('La conversación está vacía');
    }

    const deliverables = this.normalizeDeliverables(body.deliverables);
    const basePack = await this.packService.build({
      conversationId,
      stageName: body.stageName,
      stageKey: body.stageKey,
      deliverablesRequested: deliverables,
    });
    const { pack } = await this.cursorTasks.enrichPack(basePack);

    if (
      conversation.forgePromotionStatus === 'success' &&
      conversation.forgePromotionIdempotencyKey === pack.idempotencyKey &&
      conversation.forgeStageId
    ) {
      return {
        status: 'success' as const,
        alreadyPromoted: true,
        forgeProjectId: conversation.forgeProjectId,
        forgeStageId: conversation.forgeStageId,
        stageUrl: conversation.forgeStageUrl,
      };
    }

    await this.updateConversation(conversationId, {
      forgePromotionStatus: 'pending',
      forgePromotionLastError: null,
    });

    try {
      const resolved = await this.resolveForgeProjectForPromotion(pack, body.forgeProjectId);

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
      });

      return {
        status: 'success' as const,
        alreadyPromoted: false,
        forgeProjectId: created.forgeProjectId,
        forgeProjectName: resolved.forgeProjectName,
        forgeStageId: created.forgeStageId,
        stageKey: created.stageKey,
        stageName: created.stageName,
        stageUrl: created.stageUrl,
        importMode: created.importMode,
        legacyStart: created.legacyStart,
        ariadneWire: created.ariadneWire,
        recommendedNextTools: created.recommendedNextTools,
        deliverablesCreated: created.deliverablesCreated,
        warnings: resolved.warnings,
        linkKind: resolved.linkKind,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.updateConversation(conversationId, {
        forgePromotionStatus: 'failed',
        forgePromotionLastError: message,
      });

      if (err instanceof ForgeResolveAmbiguousError) {
        throw new ConflictException({
          code: 'FORGE_RESOLVE_AMBIGUOUS',
          message: err.message,
          candidates: err.candidates,
        });
      }
      if (err instanceof ForgeResolveNotFoundError) {
        throw new NotFoundException({
          code: 'FORGE_RESOLVE_NOT_FOUND',
          message: err.message,
        });
      }
      throw err;
    }
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
    patch: Partial<ChatConversationEntity>,
  ): Promise<void> {
    await this.conversations.update(conversationId, patch);
  }
}
