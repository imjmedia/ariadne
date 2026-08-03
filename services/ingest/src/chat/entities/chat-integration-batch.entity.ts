/**
 * @fileoverview Agrupa conversaciones importadas desde handoffs NEW-LEG de The Forge.
 */
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ChatConversationEntity } from './chat-conversation.entity';

@Entity('chat_integration_batches')
export class ChatIntegrationBatchEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Column({ name: 'source_forge_project_id', type: 'varchar', length: 64 })
  sourceForgeProjectId!: string;

  @Column({ name: 'source_forge_project_name', type: 'varchar', length: 256, nullable: true })
  sourceForgeProjectName!: string | null;

  @Column({ type: 'varchar', length: 256 })
  label!: string;

  @Column({ name: 'forge_project_id', type: 'varchar', length: 64, nullable: true })
  forgeProjectId!: string | null;

  @Column({ name: 'forge_stage_id', type: 'varchar', length: 64, nullable: true })
  forgeStageId!: string | null;

  @Column({ name: 'forge_stage_url', type: 'varchar', length: 512, nullable: true })
  forgeStageUrl!: string | null;

  @Column({ name: 'forge_promoted_at', type: 'timestamptz', nullable: true })
  forgePromotedAt!: Date | null;

  @Column({ name: 'forge_promotion_status', type: 'varchar', length: 16, nullable: true })
  forgePromotionStatus!: string | null;

  @Column({ name: 'forge_promotion_idempotency_key', type: 'varchar', length: 64, nullable: true })
  forgePromotionIdempotencyKey!: string | null;

  @Column({ name: 'forge_promotion_last_error', type: 'text', nullable: true })
  forgePromotionLastError!: string | null;

  @Column({ name: 'forge_promotion_phase', type: 'varchar', length: 32, nullable: true })
  forgePromotionPhase!: string | null;

  @Column({ name: 'forge_promotion_percent', type: 'smallint', nullable: true })
  forgePromotionPercent!: number | null;

  /** SHA-256 (32 hex) of stage/deliverables + batch message fingerprint — matches forge_preview_pack. */
  @Column({ name: 'forge_preview_params_hash', type: 'varchar', length: 64, nullable: true })
  forgePreviewParamsHash!: string | null;

  /** Enriched ChangePromotionPack from last preview-theforge-pack (reused on promote when hash matches). */
  @Column({ name: 'forge_preview_pack', type: 'jsonb', nullable: true })
  forgePreviewPack!: Record<string, unknown> | null;

  @Column({ name: 'forge_preview_status', type: 'varchar', length: 16, nullable: true })
  forgePreviewStatus!: string | null;

  @Column({ name: 'forge_preview_phase', type: 'varchar', length: 32, nullable: true })
  forgePreviewPhase!: string | null;

  @Column({ name: 'forge_preview_percent', type: 'smallint', nullable: true })
  forgePreviewPercent!: number | null;

  @Column({ name: 'forge_preview_last_error', type: 'text', nullable: true })
  forgePreviewLastError!: string | null;

  /** Last successful preview-theforge-pack response (summary for UI). */
  @Column({ name: 'forge_preview_result', type: 'jsonb', nullable: true })
  forgePreviewResult!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => ChatConversationEntity, (c) => c.integrationBatch)
  conversations?: ChatConversationEntity[];
}
