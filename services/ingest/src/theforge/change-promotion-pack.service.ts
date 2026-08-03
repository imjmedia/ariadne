/**
 * @fileoverview Builds ChangePromotionPack v1.1 from a persisted chat conversation.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { parseIntegrationHandoffMessage } from 'ariadne-common';
import { Repository } from 'typeorm';
import { ChatConversationEntity } from '../chat/entities/chat-conversation.entity';
import { ChatMessageEntity } from '../chat/entities/chat-message.entity';
import { ChatService } from '../chat/chat.service';
import { ModificationPlanEvidenceService } from '../chat/modification-plan-evidence.service';
import { MddPersistenceService } from '../mdd-persistence/mdd-persistence.service';
import { ProjectEntity } from '../projects/entities/project.entity';
import { RepositoriesService } from '../repositories/repositories.service';
import { RepositoryEntity } from '../repositories/entities/repository.entity';
import type { ForgeDeliverableKind } from './change-promotion-pack.types';
import {
  buildPromotionIdempotencyKey,
  buildProjectStageIdempotencyKey,
  computeIndexFreshness,
  slugifyStageKey,
  type ChangePromotionPackV1,
} from './change-promotion-pack.types';
import {
  buildChangeTitle,
  extractDecisionBullets,
  extractLastMermaidDiagram,
  extractUserMigrationNotes,
  synthesizeUserDescription,
  type ConversationMessageSlice,
} from './conversation-change-synthesizer';

export interface BuildChangePromotionPackOptions {
  conversationId: string;
  stageName?: string;
  stageKey?: string;
  deliverablesRequested: ForgeDeliverableKind[];
}

export interface BuildProjectChangePromotionPackOptions {
  projectId: string;
  changeDescription: string;
  stageName: string;
  stageKey?: string;
  conversationId?: string;
  deliverablesRequested: ForgeDeliverableKind[];
}

export interface ChangePromotionPreview {
  changeTitle: string;
  stageKeySuggested: string;
  userDescription: string;
  hasMermaid: boolean;
  erDiagramPreview: string | null;
  modificationPlanFileCount: number;
  modificationPlanSample: string[];
  indexFresh: boolean;
  indexStaleHours: number | null;
  warnings: string[];
  messageCount: number;
  pack: ChangePromotionPackV1;
}

@Injectable()
export class ChangePromotionPackService {
  constructor(
    @InjectRepository(ChatConversationEntity)
    private readonly conversations: Repository<ChatConversationEntity>,
    @InjectRepository(ChatMessageEntity)
    private readonly messages: Repository<ChatMessageEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projects: Repository<ProjectEntity>,
    private readonly repos: RepositoriesService,
    private readonly mddPersistence: MddPersistenceService,
    private readonly chat: ChatService,
    private readonly modificationPlanEvidence: ModificationPlanEvidenceService,
  ) {}

  async buildPreview(options: BuildChangePromotionPackOptions): Promise<ChangePromotionPreview> {
    const pack = await this.build(options);
    const warnings: string[] = [];
    if (!pack.ariadne.indexFresh) {
      warnings.push(
        pack.ariadne.indexStaleHours != null
          ? `Índice desactualizado (~${pack.ariadne.indexStaleHours}h). Resync recomendado.`
          : 'Sin fecha de sync conocida.',
      );
    }
    if (!pack.change.erDiagramMermaid) {
      warnings.push('No se detectó diagrama Mermaid en la conversación.');
    }
    if (pack.modificationPlan.filesToModify.length === 0) {
      warnings.push('Plan de modificación vacío; Forge generará menos detalle de archivos.');
    }
    return {
      changeTitle: pack.change.title,
      stageKeySuggested: pack.change.stageKey,
      userDescription: pack.change.userDescription,
      hasMermaid: Boolean(pack.change.erDiagramMermaid),
      erDiagramPreview: pack.change.erDiagramMermaid?.slice(0, 500) ?? null,
      modificationPlanFileCount: pack.modificationPlan.filesToModify.length,
      modificationPlanSample: pack.modificationPlan.filesToModify.slice(0, 8).map((f) => f.path),
      indexFresh: pack.ariadne.indexFresh,
      indexStaleHours: pack.ariadne.indexStaleHours,
      warnings,
      messageCount: await this.messages.count({ where: { conversationId: options.conversationId } }),
      pack,
    };
  }

  async build(options: BuildChangePromotionPackOptions): Promise<ChangePromotionPackV1> {
    const conversation = await this.conversations.findOne({ where: { id: options.conversationId } });
    if (!conversation) throw new NotFoundException('Conversación no encontrada');

    const messageRows = await this.messages.find({
      where: { conversationId: options.conversationId },
      order: { createdAt: 'ASC' },
      take: 500,
    });
    if (messageRows.length === 0) {
      throw new BadRequestException('La conversación no tiene mensajes para promover');
    }

    const slices = messageRows.map((m) => ({ role: m.role, content: m.content }));
    const userDescription = synthesizeUserDescription(conversation.title, slices);
    const changeTitle = buildChangeTitle(options.stageName, conversation.title, userDescription);
    const stageKey = (options.stageKey?.trim() || slugifyStageKey(changeTitle)).slice(0, 48);

    const { repository, falkorProjectId } = await this.resolveRepositoryContext(conversation);
    const freshness = computeIndexFreshness(repository?.lastSyncAt ?? null);

    let mdd: Record<string, unknown>;
    const repoId = repository?.id ?? conversation.repositoryId;
    if (repoId) {
      const snap = await this.mddPersistence.getLatest(repoId);
      if (snap?.mddJson) {
        mdd = snap.mddJson;
      } else {
        const doc = await this.chat.buildMddEvidenceForRepository(
          repoId,
          falkorProjectId,
          userDescription,
          '',
          [],
          false,
        );
        mdd = doc as unknown as Record<string, unknown>;
      }
    } else {
      mdd = { summary: userDescription, evidence_paths: [] };
    }

    const isIntegrationHandoff = Boolean(
      conversation.integrationHandoffId?.trim() || conversation.integrationBatchId,
    );
    const parsedHandoff = isIntegrationHandoff
      ? parseIntegrationHandoffMessage(userDescription)
      : null;

    let filesToModify: Array<{ path: string; repoId?: string }>;
    let graphEvidenceBundle: ChangePromotionPackV1['graphEvidenceBundle'];
    let changePlanSeed: ChangePromotionPackV1['changePlanSeed'];
    let questionsToRefine: string[] | undefined;

    if (isIntegrationHandoff) {
      const plan = await this.chat.getIntegrationHandoffPlanByProject(
        falkorProjectId,
        userDescription,
        repository ? { repoIds: [repository.id] } : undefined,
      );
      filesToModify = plan.filesToModify.slice(0, 80).map((f) => ({
        path: f.path,
        ...(f.repoId ? { repoId: f.repoId } : {}),
      }));
      graphEvidenceBundle = plan.graphEvidenceBundle;
      changePlanSeed = plan.changePlanTemplate;
      questionsToRefine = plan.questionsToRefine?.length ? plan.questionsToRefine : undefined;
    } else {
      const modFiles = await this.chat.getModificationPlanFilesOnlyByProject(
        falkorProjectId,
        userDescription.slice(0, 2000),
        repository ? { repoIds: [repository.id] } : undefined,
      );
      filesToModify = modFiles.slice(0, 80).map((f) => ({
        path: f.path,
        ...(f.repoId ? { repoId: f.repoId } : {}),
      }));
      const evidence = await this.buildEvidenceForFiles(
        falkorProjectId,
        repository,
        filesToModify,
        userDescription,
      );
      graphEvidenceBundle = evidence.graphEvidenceBundle;
      changePlanSeed = evidence.changePlanSeed;
    }

    const idempotencyKey = buildPromotionIdempotencyKey(
      conversation.id,
      stageKey,
      repository?.lastCommitSha ?? null,
    );

    return {
      schemaVersion: '1.1',
      source: 'ariadne',
      kind: 'change_promotion',
      generatedAt: new Date().toISOString(),
      idempotencyKey,
      ariadne: {
        conversationId: conversation.id,
        conversationTitle: conversation.title,
        repositoryId: repository?.id ?? conversation.repositoryId,
        projectId: falkorProjectId,
        projectKey: repository?.projectKey ?? null,
        repoSlug: repository?.repoSlug ?? null,
        commitSha: repository?.lastCommitSha ?? null,
        indexFresh: freshness.indexFresh,
        indexStaleHours: freshness.indexStaleHours,
      },
      change: {
        title: changeTitle,
        stageKey,
        userDescription,
        decisions: extractDecisionBullets(slices),
        erDiagramMermaid: extractLastMermaidDiagram(slices),
        migrationNotes: extractUserMigrationNotes(slices),
      },
      mdd,
      modificationPlan: {
        filesToModify,
        ...(questionsToRefine?.length ? { questionsToRefine } : {}),
      },
      ...(graphEvidenceBundle ? { graphEvidenceBundle } : {}),
      ...(changePlanSeed ? { changePlanSeed } : {}),
      ...(isIntegrationHandoff
        ? {
            promotionScope: 'integration_handoff' as const,
            integrationHandoff: {
              handoffId: parsedHandoff?.handoffId ?? conversation.integrationHandoffId,
              title: parsedHandoff?.title ?? conversation.title,
              sourceProject: parsedHandoff?.sourceProject ?? null,
              acceptanceCriteria: parsedHandoff?.acceptanceCriteria ?? [],
            },
          }
        : {}),
      deliverablesRequested: options.deliverablesRequested,
    };
  }

  async buildFromProject(options: BuildProjectChangePromotionPackOptions): Promise<ChangePromotionPackV1> {
    const project = await this.projects.findOne({ where: { id: options.projectId } });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    const changeDescription = options.changeDescription.trim();
    if (!changeDescription) {
      throw new BadRequestException('La descripción del cambio es obligatoria');
    }

    const stageName = options.stageName.trim();
    if (!stageName) throw new BadRequestException('El nombre de etapa es obligatorio');

    const changeTitle = buildChangeTitle(stageName, project.name, changeDescription);
    const stageKey = (options.stageKey?.trim() || slugifyStageKey(changeTitle)).slice(0, 48);

    const repoList = await this.repos.findAll(options.projectId);
    const repository = repoList[0] ?? null;
    const freshness = computeIndexFreshness(repository?.lastSyncAt ?? null);

    let slices: ConversationMessageSlice[] = [];
    let conversationId = options.conversationId?.trim() || '';
    let conversationTitle: string | null = null;

    if (conversationId) {
      const conversation = await this.conversations.findOne({ where: { id: conversationId } });
      if (conversation) {
        conversationTitle = conversation.title;
        const messageRows = await this.messages.find({
          where: { conversationId },
          order: { createdAt: 'ASC' },
          take: 500,
        });
        slices = messageRows.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
      } else {
        conversationId = '';
      }
    }

    const userDescription =
      slices.length > 0
        ? synthesizeUserDescription(conversationTitle, slices)
        : changeDescription;

    let mdd: Record<string, unknown>;
    const repoId = repository?.id ?? repoList[0]?.id;
    if (repoId) {
      const snap = await this.mddPersistence.getLatest(repoId);
      if (snap?.mddJson) {
        mdd = snap.mddJson;
      } else {
        const doc = await this.chat.buildMddEvidenceForRepository(
          repoId,
          options.projectId,
          userDescription,
          '',
          [],
          false,
        );
        mdd = doc as unknown as Record<string, unknown>;
      }
    } else {
      mdd = { summary: userDescription, evidence_paths: [] };
    }

    const modFiles = await this.chat.getModificationPlanFilesOnlyByProject(
      options.projectId,
      userDescription.slice(0, 2000),
      repoList.length ? { repoIds: repoList.map((r) => r.id) } : undefined,
    );

    const filesToModify = modFiles.slice(0, 80).map((f) => ({
      path: f.path,
      ...(f.repoId ? { repoId: f.repoId } : {}),
    }));

    const idempotencyKey = buildProjectStageIdempotencyKey(
      options.projectId,
      stageKey,
      repository?.lastCommitSha ?? null,
    );

    const evidence = await this.buildEvidenceForFiles(
      options.projectId,
      repository,
      filesToModify,
      userDescription,
    );

    return {
      schemaVersion: '1.1',
      source: 'ariadne',
      kind: 'change_promotion',
      generatedAt: new Date().toISOString(),
      idempotencyKey,
      ariadne: {
        conversationId: conversationId || `project:${options.projectId}`,
        conversationTitle,
        repositoryId: repository?.id ?? null,
        projectId: options.projectId,
        projectKey: repository?.projectKey ?? null,
        repoSlug: repository?.repoSlug ?? null,
        commitSha: repository?.lastCommitSha ?? null,
        indexFresh: freshness.indexFresh,
        indexStaleHours: freshness.indexStaleHours,
      },
      change: {
        title: changeTitle,
        stageKey,
        userDescription: changeDescription,
        decisions: extractDecisionBullets(slices),
        erDiagramMermaid: extractLastMermaidDiagram(slices),
        migrationNotes: extractUserMigrationNotes(slices),
      },
      mdd,
      modificationPlan: {
        filesToModify,
      },
      ...evidence,
      deliverablesRequested: options.deliverablesRequested,
    };
  }

  private async buildEvidenceForFiles(
    projectId: string,
    repository: RepositoryEntity | null,
    filesToModify: Array<{ path: string; repoId?: string }>,
    changeDescription: string,
  ): Promise<{
    graphEvidenceBundle?: ChangePromotionPackV1['graphEvidenceBundle'];
    changePlanSeed?: ChangePromotionPackV1['changePlanSeed'];
  }> {
    if (filesToModify.length === 0) return {};
    try {
      const graphEvidenceBundle = await this.modificationPlanEvidence.buildEvidenceBundle(
        projectId,
        filesToModify.map((f, i) => ({
          path: f.path,
          repoId: f.repoId ?? repository?.id ?? projectId,
          impactScore: Math.max(1, filesToModify.length - i) * 10,
        })),
      );
      const changePlanSeed = this.modificationPlanEvidence.buildChangePlanSeed({
        projectId,
        changeDescription,
        source: 'theforge',
        filesToModify: filesToModify.map((f) => ({
          path: f.path,
          repoId: f.repoId ?? repository?.id ?? projectId,
        })),
        bundle: graphEvidenceBundle,
      });
      return { graphEvidenceBundle, changePlanSeed };
    } catch {
      return {};
    }
  }

  private async resolveRepositoryContext(
    conversation: ChatConversationEntity,
  ): Promise<{ repository: RepositoryEntity | null; falkorProjectId: string }> {
    if (conversation.repositoryId) {
      const repository = await this.repos.findOne(conversation.repositoryId);
      const projectIds = await this.repos.getProjectIdsForRepo(conversation.repositoryId);
      const falkorProjectId = conversation.projectId ?? projectIds[0] ?? conversation.repositoryId;
      return { repository, falkorProjectId };
    }
    if (conversation.projectId) {
      const list = await this.repos.findAll(conversation.projectId);
      const repository = list[0] ?? null;
      return { repository, falkorProjectId: conversation.projectId };
    }
    throw new BadRequestException('Conversación sin ámbito repo/proyecto');
  }
}
