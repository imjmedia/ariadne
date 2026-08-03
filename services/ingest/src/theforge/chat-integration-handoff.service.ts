/**
 * Import NEW-LEG handoffs as grouped chat conversations + batch Forge promotion.
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
import { In, Repository } from 'typeorm';
import type { CredentialActor } from '../credentials/credential-actor';
import { ChatConversationEntity } from '../chat/entities/chat-conversation.entity';
import { ChatIntegrationBatchEntity } from '../chat/entities/chat-integration-batch.entity';
import { ChatMessageEntity } from '../chat/entities/chat-message.entity';
import { ProjectEntity } from '../projects/entities/project.entity';
import { ProjectRepositoryEntity } from '../repositories/entities/project-repository.entity';
import { RepositoryEntity } from '../repositories/entities/repository.entity';
import { ChangePromotionPackService } from './change-promotion-pack.service';
import type { ChangePromotionPackV1, ForgeDeliverableKind } from './change-promotion-pack.types';
import { CursorTasksDocumentService } from './cursor-tasks-document.service';
import { buildHandoffSeedMessage } from './integration-handoff.util';
import type {
  ChatIntegrationBatchDto,
  ImportIntegrationHandoffsResult,
} from './integration-handoff.types';
import { mergeChangePromotionPacks } from './integration-pack-merge.util';
import {
  buildBatchContentFingerprint,
  buildIntegrationPreviewParamsHash,
  resolveIntegrationPreviewStageKey,
} from './integration-preview-cache.util';
import { FORGE_PROMOTION_PENDING_TTL_MS } from './forge-timeout.constants';
import { formatForgePromotionError } from './forge-http.util';
import { forgePromotionProgressPatch, type ForgePromotionPhase } from './forge-promotion-progress.util';
import {
  forgePreviewMergePercent,
  forgePreviewProgressPatch,
  type ForgePreviewPhase,
} from './forge-preview-progress.util';
import { TheForgeClient } from './theforge-client.service';
import { TheForgeIntegrationHandoffCatalogService } from './theforge-integration-handoff-catalog.service';
import { TheForgeIntegrationService } from './theforge-integration.service';

export interface PromoteIntegrationBatchBody {
  stageName: string;
  stageKey?: string;
  deliverables: ForgeDeliverableKind[];
  activate?: boolean;
  /** LEGACY destino; si no se envía, usa el vinculado al proyecto Ariadne. */
  forgeProjectId?: string;
}

export type PromoteIntegrationBatchResult = { status: 'pending' };

export type PreviewIntegrationBatchResult = { status: 'pending' };

@Injectable()
export class ChatIntegrationHandoffService {
  private readonly logger = new Logger(ChatIntegrationHandoffService.name);

  constructor(
    @InjectRepository(ChatIntegrationBatchEntity)
    private readonly batches: Repository<ChatIntegrationBatchEntity>,
    @InjectRepository(ChatConversationEntity)
    private readonly conversations: Repository<ChatConversationEntity>,
    @InjectRepository(ChatMessageEntity)
    private readonly messages: Repository<ChatMessageEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(ProjectRepositoryEntity)
    private readonly projectRepos: Repository<ProjectRepositoryEntity>,
    @InjectRepository(RepositoryEntity)
    private readonly repositories: Repository<RepositoryEntity>,
    private readonly catalog: TheForgeIntegrationHandoffCatalogService,
    private readonly packService: ChangePromotionPackService,
    private readonly cursorTasks: CursorTasksDocumentService,
    private readonly forgeClient: TheForgeClient,
    private readonly integration: TheForgeIntegrationService,
  ) {}

  async listSources(_actor: CredentialActor, projectId: string) {
    await this.assertProjectLinked(projectId);
    return this.catalog.listSourcesWithHandoffs();
  }

  async importHandoffs(
    actor: CredentialActor,
    projectId: string,
    sourceForgeProjectId: string,
  ): Promise<ImportIntegrationHandoffsResult> {
    const userId = this.requireUserId(actor);
    await this.assertProjectLinked(projectId);

    const source = await this.catalog.getProjectHandoffs(sourceForgeProjectId.trim());
    const batchLabel = `Integración — ${source.forgeProjectName}`;

    let batch = await this.batches.findOne({
      where: {
        userId,
        projectId,
        sourceForgeProjectId: source.forgeProjectId,
      },
    });
    if (!batch) {
      batch = await this.batches.save(
        this.batches.create({
          userId,
          projectId,
          sourceForgeProjectId: source.forgeProjectId,
          sourceForgeProjectName: source.forgeProjectName,
          label: batchLabel,
        }),
      );
    }

    const existing = await this.conversations.find({
      where: { integrationBatchId: batch.id },
      select: ['id', 'integrationHandoffId', 'title'],
    });
    const existingIds = new Set(
      existing.map((c) => c.integrationHandoffId).filter((id): id is string => Boolean(id)),
    );

    const created: ImportIntegrationHandoffsResult['created'] = [];
    const skipped: ImportIntegrationHandoffsResult['skipped'] = [];

    for (const item of source.items) {
      if (existingIds.has(item.id)) {
        skipped.push({
          handoffId: item.id,
          title: item.title,
          reason: 'Ya importado en este lote de integración',
        });
        continue;
      }

      const conversation = await this.conversations.save(
        this.conversations.create({
          userId,
          projectId,
          repositoryId: null,
          title: `${item.id} — ${item.title}`,
          integrationBatchId: batch.id,
          integrationHandoffId: item.id,
        }),
      );

      await this.messages.save(
        this.messages.create({
          conversationId: conversation.id,
          role: 'user',
          content: buildHandoffSeedMessage(item, source.forgeProjectName),
          cypher: null,
        }),
      );

      created.push({
        conversationId: conversation.id,
        handoffId: item.id,
        title: item.title,
      });
      existingIds.add(item.id);
    }

    batch.updatedAt = new Date();
    await this.batches.save(batch);

    return {
      batchId: batch.id,
      batchLabel: batch.label,
      sourceForgeProjectId: batch.sourceForgeProjectId,
      sourceForgeProjectName: batch.sourceForgeProjectName ?? source.forgeProjectName,
      created,
      skipped,
    };
  }

  async getBatch(actor: CredentialActor, batchId: string): Promise<ChatIntegrationBatchDto> {
    const batch = await this.getOwnedBatch(actor, batchId);
    const conversationCount = await this.conversations.count({
      where: { integrationBatchId: batch.id },
    });
    return this.toBatchDto(batch, conversationCount);
  }

  async deleteBatch(actor: CredentialActor, batchId: string): Promise<void> {
    const batch = await this.getOwnedBatch(actor, batchId);
    const conversationRows = await this.conversations.find({
      where: { integrationBatchId: batch.id },
    });
    if (conversationRows.length > 0) {
      await this.conversations.remove(conversationRows);
    }
    await this.batches.remove(batch);
  }

  async findBatchForConversation(
    actor: CredentialActor,
    conversationId: string,
  ): Promise<ChatIntegrationBatchDto | null> {
    const userId = this.requireUserId(actor);
    const conversation = await this.conversations.findOne({ where: { id: conversationId } });
    if (!conversation || conversation.userId !== userId || !conversation.integrationBatchId) {
      return null;
    }
    const batch = await this.batches.findOne({ where: { id: conversation.integrationBatchId } });
    if (!batch) return null;
    const conversationCount = await this.conversations.count({
      where: { integrationBatchId: batch.id },
    });
    return this.toBatchDto(batch, conversationCount);
  }

  async previewBatchPromotion(
    actor: CredentialActor,
    batchId: string,
    body: Partial<PromoteIntegrationBatchBody>,
  ): Promise<PreviewIntegrationBatchResult> {
    if (!(await this.integration.isChatPromotionAvailable())) {
      throw new ServiceUnavailableException({
        code: 'FORGE_NOT_CONFIGURED',
        message: 'The Forge no está configurado.',
      });
    }

    const batch = await this.getOwnedBatch(actor, batchId);
    await this.clearStalePendingPreview(batch);
    this.resolveBatchForgeProject(
      await this.getProjectOrThrow(batch.projectId),
      body.forgeProjectId,
    );
    this.normalizeDeliverables(body.deliverables);

    await this.batches.update(batch.id, {
      forgePreviewStatus: 'pending',
      forgePreviewLastError: null,
      forgePreviewResult: null,
      ...forgePreviewProgressPatch('pack_merge'),
    });

    void this.runPreviewBatchJob(batchId, body).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`previewBatch ${batchId} background job crashed: ${message}`);
    });

    return { status: 'pending' };
  }

  async getBatchPreviewResult(actor: CredentialActor, batchId: string) {
    const batch = await this.getOwnedBatch(actor, batchId);
    if (batch.forgePreviewStatus !== 'success' || !batch.forgePreviewResult) {
      throw new BadRequestException('No hay vista previa lista para este lote.');
    }
    const conversationCount = await this.conversations.count({
      where: { integrationBatchId: batch.id },
    });
    return {
      ...(batch.forgePreviewResult as Record<string, unknown>),
      batch: this.toBatchDto(batch, conversationCount),
    };
  }

  private async runPreviewBatchJob(
    batchId: string,
    body: Partial<PromoteIntegrationBatchBody>,
  ): Promise<void> {
    try {
      const batch = await this.batches.findOne({ where: { id: batchId } });
      if (!batch) return;

      const project = await this.getProjectOrThrow(batch.projectId);
      const targetForge = this.resolveBatchForgeProject(project, body.forgeProjectId);
      const deliverables = this.normalizeDeliverables(body.deliverables);
      const stageName = body.stageName?.trim() || batch.label;

      await this.updateBatchPreviewPhase(batchId, 'pack_merge');

      const merged = await this.buildMergedPack(batch, stageName, body.stageKey, deliverables, {
        trackPreviewProgress: true,
      });

      await this.updateBatchPreviewPhase(batchId, 'pack_enrich');
      const enriched = await this.cursorTasks.enrichPack(merged);
      await this.savePreviewPackCache(batch, stageName, body.stageKey, deliverables, enriched.pack);

      const warnings: string[] = [];
      if (!enriched.pack.ariadne.indexFresh) {
        warnings.push('Índice desactualizado; resync recomendado antes de promover.');
      }
      if (enriched.pack.modificationPlan.filesToModify.length === 0) {
        warnings.push('Plan de modificación vacío tras fusionar los chats del lote.');
      }
      warnings.push(...(await this.repoForgeMismatchWarnings(batch.projectId, targetForge.forgeProjectId)));

      const conversationCount = await this.conversations.count({
        where: { integrationBatchId: batch.id },
      });

      const result = {
        preview: {
          stageName,
          stageKeySuggested: enriched.pack.change.stageKey,
          conversationCount,
          modificationPlanFileCount: enriched.pack.modificationPlan.filesToModify.length,
          modificationPlanSample: enriched.pack.modificationPlan.filesToModify
            .slice(0, 8)
            .map((f) => f.path),
          warnings,
        },
        linkedForgeProject: project.theforgeProjectId
          ? {
              forgeProjectId: project.theforgeProjectId,
              forgeProjectName: project.theforgeProjectName ?? project.theforgeProjectId,
              linkKind: 'primary' as const,
            }
          : null,
        targetForgeProject: {
          forgeProjectId: targetForge.forgeProjectId,
          forgeProjectName: targetForge.forgeProjectName,
          linkKind: targetForge.linkKind,
        },
        promoteEnabled: await this.integration.isChatPromotionAvailable(),
      };

      const freshBatch = await this.batches.findOne({ where: { id: batchId } });
      if (!freshBatch) return;
      freshBatch.forgePreviewStatus = 'success';
      freshBatch.forgePreviewLastError = null;
      freshBatch.forgePreviewResult = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
      Object.assign(freshBatch, forgePreviewProgressPatch('done'));
      await this.batches.save(freshBatch);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`previewBatch ${batchId} failed: ${message}`);
      await this.batches.update(batchId, {
        forgePreviewStatus: 'failed',
        forgePreviewLastError: message,
        forgePreviewResult: null,
        ...forgePreviewProgressPatch('failed'),
      });
    }
  }

  private async clearStalePendingPreview(batch: ChatIntegrationBatchEntity): Promise<void> {
    if (batch.forgePreviewStatus !== 'pending') return;
    const ageMs = Date.now() - batch.updatedAt.getTime();
    if (ageMs < FORGE_PROMOTION_PENDING_TTL_MS) {
      throw new ConflictException(
        'Ya hay una vista previa en curso para este lote. Espera unos minutos o vuelve a intentar cuando expire.',
      );
    }
    this.logger.warn(
      `Batch ${batch.id} preview pending for ${Math.round(ageMs / 1000)}s — allowing retry`,
    );
    await this.batches.update(batch.id, {
      forgePreviewStatus: 'failed',
      forgePreviewLastError:
        'La vista previa anterior no terminó (timeout o error de red). Se permite reintentar.',
      ...forgePreviewProgressPatch('failed'),
    });
    batch.forgePreviewStatus = 'failed';
  }

  private async updateBatchPreviewPhase(
    batchId: string,
    phase: ForgePreviewPhase,
    percent?: number,
  ): Promise<void> {
    await this.batches.update(batchId, forgePreviewProgressPatch(phase, percent));
  }

  async promoteBatch(
    actor: CredentialActor,
    batchId: string,
    body: PromoteIntegrationBatchBody,
  ): Promise<PromoteIntegrationBatchResult> {
    if (!(await this.integration.isChatPromotionAvailable())) {
      throw new ServiceUnavailableException({
        code: 'FORGE_NOT_CONFIGURED',
        message: 'The Forge no está configurado.',
      });
    }

    const batch = await this.getOwnedBatch(actor, batchId);
    await this.clearStalePendingPromotion(batch);

    const stageName = body.stageName?.trim();
    if (!stageName) throw new BadRequestException('Indica un nombre para la etapa');

    this.normalizeDeliverables(body.deliverables);

    await this.batches.update(batch.id, {
      forgePromotionStatus: 'pending',
      forgePromotionLastError: null,
      ...forgePromotionProgressPatch('pack_resolve'),
    });

    void this.runPromoteBatchJob(batchId, body).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`promoteBatch ${batchId} background job crashed: ${message}`);
    });

    return { status: 'pending' };
  }

  private async runPromoteBatchJob(
    batchId: string,
    body: PromoteIntegrationBatchBody,
  ): Promise<void> {
    try {
      const batch = await this.batches.findOne({ where: { id: batchId } });
      if (!batch) return;

      const project = await this.getProjectOrThrow(batch.projectId);
      const targetForge = this.resolveBatchForgeProject(project, body.forgeProjectId);
      const forgeProjectId = targetForge.forgeProjectId;
      const stageName = body.stageName.trim();
      const deliverables = this.normalizeDeliverables(body.deliverables);

      await this.updateBatchPromotionPhase(batchId, 'pack_resolve');

      const { pack, fromPreviewCache } = await this.resolveEnrichedPackForPromotion(
        batch,
        stageName,
        body.stageKey,
        deliverables,
      );
      this.logger.log(
        `promoteBatch ${batchId}: pack ${fromPreviewCache ? 'from preview cache' : 'rebuilt'} (${pack.modificationPlan.filesToModify.length} files)`,
      );

      const fresh = await this.batches.findOne({ where: { id: batchId } });
      if (
        fresh?.forgePromotionStatus === 'success' &&
        fresh.forgePromotionIdempotencyKey === pack.idempotencyKey &&
        fresh.forgeStageId
      ) {
        await this.batches.update(batchId, forgePromotionProgressPatch('done'));
        return;
      }

      await this.updateBatchPromotionPhase(batchId, 'forge_create');
      this.logger.log(`promoteBatch ${batchId}: creating Forge stage…`);

      const created = await this.forgeClient.createStageFromChangePack({
        forgeProjectId,
        pack,
        stageName,
        activate: body.activate ?? false,
        runLegacyStart: pack.modificationPlan.filesToModify.length === 0 ? undefined : false,
        wireAriadne: true,
        linkedNewProjectId: batch.sourceForgeProjectId,
      });

      await this.batches.update(batchId, {
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
      const message = formatForgePromotionError(err);
      this.logger.warn(`promoteBatch ${batchId} failed: ${message}`);
      await this.batches.update(batchId, {
        forgePromotionStatus: 'failed',
        forgePromotionLastError: message,
        ...forgePromotionProgressPatch('failed'),
      });
    }
  }

  private async updateBatchPromotionPhase(
    batchId: string,
    phase: ForgePromotionPhase,
  ): Promise<void> {
    await this.batches.update(batchId, forgePromotionProgressPatch(phase));
  }

  private async clearStalePendingPromotion(batch: ChatIntegrationBatchEntity): Promise<void> {
    if (batch.forgePromotionStatus !== 'pending') return;
    const ageMs = Date.now() - batch.updatedAt.getTime();
    if (ageMs < FORGE_PROMOTION_PENDING_TTL_MS) {
      throw new ConflictException(
        'Ya hay una promoción en curso para este lote. Espera unos minutos o vuelve a intentar cuando expire.',
      );
    }
    this.logger.warn(
      `Batch ${batch.id} promotion pending for ${Math.round(ageMs / 1000)}s — allowing retry`,
    );
    await this.batches.update(batch.id, {
      forgePromotionStatus: 'failed',
      forgePromotionLastError:
        'La promoción anterior no terminó (timeout o error de red). Se permite reintentar.',
      ...forgePromotionProgressPatch('failed'),
    });
    batch.forgePromotionStatus = 'failed';
  }

  private async batchContentFingerprint(batchId: string): Promise<string> {
    const rows = await this.conversations
      .createQueryBuilder('c')
      .leftJoin('chat_messages', 'm', 'm.conversation_id = c.id')
      .select('c.id', 'conversationId')
      .addSelect('COUNT(m.id)', 'messageCount')
      .addSelect('MAX(m.created_at)', 'lastMessageAt')
      .where('c.integration_batch_id = :batchId', { batchId })
      .groupBy('c.id')
      .getRawMany<{ conversationId: string; messageCount: string; lastMessageAt: string | null }>();

    return buildBatchContentFingerprint(
      rows.map((row) => ({
        conversationId: row.conversationId,
        messageCount: parseInt(row.messageCount, 10) || 0,
        lastMessageAt: row.lastMessageAt,
      })),
    );
  }

  private async previewParamsHash(
    batch: ChatIntegrationBatchEntity,
    stageName: string,
    stageKey: string | undefined,
    deliverables: ForgeDeliverableKind[],
  ): Promise<string> {
    const contentFingerprint = await this.batchContentFingerprint(batch.id);
    return buildIntegrationPreviewParamsHash({
      batchId: batch.id,
      stageName,
      stageKey,
      deliverables,
      contentFingerprint,
    });
  }

  private async savePreviewPackCache(
    batch: ChatIntegrationBatchEntity,
    stageName: string,
    stageKey: string | undefined,
    deliverables: ForgeDeliverableKind[],
    pack: ChangePromotionPackV1,
  ): Promise<void> {
    const resolvedStageKey = resolveIntegrationPreviewStageKey(stageKey, pack.change.stageKey);
    const hash = await this.previewParamsHash(batch, stageName, resolvedStageKey, deliverables);
    const serialized = JSON.parse(JSON.stringify(pack)) as Record<string, unknown>;
    batch.forgePreviewParamsHash = hash;
    batch.forgePreviewPack = serialized;
    await this.batches.save(batch);
  }

  private cachedPreviewPackStageKey(batch: ChatIntegrationBatchEntity): string {
    const cached = batch.forgePreviewPack;
    if (!cached || typeof cached !== 'object') return '';
    const change = (cached as { change?: { stageKey?: string } }).change;
    return change?.stageKey?.trim() ?? '';
  }

  private async resolveEnrichedPackForPromotion(
    batch: ChatIntegrationBatchEntity,
    stageName: string,
    stageKey: string | undefined,
    deliverables: ForgeDeliverableKind[],
  ): Promise<{ pack: ChangePromotionPackV1; fromPreviewCache: boolean }> {
    const resolvedStageKey = resolveIntegrationPreviewStageKey(
      stageKey,
      this.cachedPreviewPackStageKey(batch),
    );
    const hash = await this.previewParamsHash(batch, stageName, resolvedStageKey, deliverables);
    if (
      batch.forgePreviewParamsHash === hash &&
      batch.forgePreviewPack &&
      typeof batch.forgePreviewPack === 'object'
    ) {
      return { pack: batch.forgePreviewPack as unknown as ChangePromotionPackV1, fromPreviewCache: true };
    }

    this.logger.log(`promoteBatch ${batch.id}: rebuilding merged pack (preview cache miss)`);
    await this.updateBatchPromotionPhase(batch.id, 'pack_enrich');
    const merged = await this.buildMergedPack(batch, stageName, stageKey, deliverables);
    const { pack } = await this.cursorTasks.enrichPack(merged);
    await this.savePreviewPackCache(batch, stageName, stageKey, deliverables, pack);
    return { pack, fromPreviewCache: false };
  }

  private async buildMergedPack(
    batch: ChatIntegrationBatchEntity,
    stageName: string,
    stageKey: string | undefined,
    deliverables: ForgeDeliverableKind[],
    options?: { trackPreviewProgress?: boolean },
  ): Promise<ChangePromotionPackV1> {
    const conversationRows = await this.conversations.find({
      where: { integrationBatchId: batch.id },
      order: { createdAt: 'ASC' },
    });
    if (conversationRows.length === 0) {
      throw new BadRequestException('El lote no tiene conversaciones');
    }

    const eligible: ChatConversationEntity[] = [];
    for (const conversation of conversationRows) {
      const messageCount = await this.messages.count({ where: { conversationId: conversation.id } });
      if (messageCount > 0) eligible.push(conversation);
    }

    if (eligible.length === 0) {
      throw new BadRequestException('Ningún chat del lote tiene mensajes para promover');
    }

    const packs: ChangePromotionPackV1[] = [];
    for (let i = 0; i < eligible.length; i++) {
      const conversation = eligible[i];
      packs.push(
        await this.packService.build({
          conversationId: conversation.id,
          stageName,
          stageKey,
          deliverablesRequested: deliverables,
        }),
      );
      if (options?.trackPreviewProgress) {
        await this.updateBatchPreviewPhase(
          batch.id,
          'pack_merge',
          forgePreviewMergePercent(i + 1, eligible.length),
        );
      }
    }

    return mergeChangePromotionPacks({
      packs,
      stageName,
      stageKey,
      batchId: batch.id,
    });
  }

  private async getProjectOrThrow(projectId: string): Promise<ProjectEntity> {
    const project = await this.projects.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    return project;
  }

  private async assertProjectLinked(projectId: string): Promise<ProjectEntity> {
    const project = await this.getProjectOrThrow(projectId);
    if (!project.theforgeProjectId?.trim()) {
      throw new BadRequestException({
        code: 'FORGE_NOT_LINKED',
        message: 'Vincula este proyecto Ariadne a The Forge antes de importar handoffs.',
      });
    }
    return project;
  }

  private resolveBatchForgeProject(
    project: ProjectEntity,
    explicitForgeProjectId?: string,
  ): {
    forgeProjectId: string;
    forgeProjectName: string;
    linkKind: 'primary' | 'explicit';
  } {
    const explicit = explicitForgeProjectId?.trim();
    if (explicit) {
      const linked = project.theforgeProjectId?.trim();
      return {
        forgeProjectId: explicit,
        forgeProjectName:
          linked === explicit
            ? project.theforgeProjectName?.trim() || explicit
            : explicit,
        linkKind: linked === explicit ? 'primary' : 'explicit',
      };
    }

    const linked = project.theforgeProjectId?.trim();
    if (!linked) {
      throw new BadRequestException({
        code: 'FORGE_DESTINATION_REQUIRED',
        message:
          'Selecciona un proyecto LEGACY de The Forge en el modal o vincula el proyecto Ariadne en su detalle.',
      });
    }

    return {
      forgeProjectId: linked,
      forgeProjectName: project.theforgeProjectName?.trim() || linked,
      linkKind: 'primary',
    };
  }

  private async repoForgeMismatchWarnings(
    projectId: string,
    selectedForgeId: string,
  ): Promise<string[]> {
    const prs = await this.projectRepos.find({
      where: { projectId },
      select: ['repoId'],
    });
    if (prs.length === 0) return [];

    const repos = await this.repositories.find({
      where: { id: In(prs.map((pr) => pr.repoId)) },
      select: ['id', 'repoSlug', 'theforgeProjectId'],
    });
    const mismatched = repos.filter((repo) => {
      const repoForgeId = repo.theforgeProjectId?.trim();
      return repoForgeId && repoForgeId !== selectedForgeId;
    });
    if (mismatched.length === 0) return [];

    const labels = mismatched
      .map((repo) => repo.repoSlug?.trim() || repo.id)
      .slice(0, 4)
      .join(', ');
    return [
      `${mismatched.length} repo(s) del proyecto Ariadne tienen otro theforgeProjectId (${labels}${mismatched.length > 4 ? '…' : ''}).`,
    ];
  }

  private async getOwnedBatch(actor: CredentialActor, batchId: string): Promise<ChatIntegrationBatchEntity> {
    const userId = this.requireUserId(actor);
    const batch = await this.batches.findOne({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Lote de integración no encontrado');
    if (batch.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a este lote');
    }
    return batch;
  }

  private toBatchDto(batch: ChatIntegrationBatchEntity, conversationCount: number): ChatIntegrationBatchDto {
    return {
      id: batch.id,
      label: batch.label,
      sourceForgeProjectId: batch.sourceForgeProjectId,
      sourceForgeProjectName: batch.sourceForgeProjectName,
      conversationCount,
      forgePromotionStatus: batch.forgePromotionStatus,
      forgePromotionPhase: batch.forgePromotionPhase,
      forgePromotionPercent: batch.forgePromotionPercent,
      forgePromotionLastError: batch.forgePromotionLastError,
      forgeProjectId: batch.forgeProjectId,
      forgeStageId: batch.forgeStageId,
      forgeStageUrl: batch.forgeStageUrl,
      forgePreviewStatus: batch.forgePreviewStatus,
      forgePreviewPhase: batch.forgePreviewPhase,
      forgePreviewPercent: batch.forgePreviewPercent,
      forgePreviewLastError: batch.forgePreviewLastError,
      createdAt: batch.createdAt.toISOString(),
    };
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

  private requireUserId(actor: CredentialActor): string {
    if (!actor.userId) {
      throw new ForbiddenException('Usuario no identificado');
    }
    return actor.userId;
  }
}
