/**
 * @fileoverview Conversación de chat persistida por usuario y repo/proyecto.
 */
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ChatIntegrationBatchEntity } from './chat-integration-batch.entity';
import { ChatMessageEntity } from './chat-message.entity';

@Entity('chat_conversations')
export class ChatConversationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'repository_id', type: 'uuid', nullable: true })
  repositoryId!: string | null;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId!: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  title!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

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

  @Column({ name: 'integration_batch_id', type: 'uuid', nullable: true })
  integrationBatchId!: string | null;

  @Column({ name: 'integration_handoff_id', type: 'varchar', length: 32, nullable: true })
  integrationHandoffId!: string | null;

  @Column({ name: 'forge_preview_status', type: 'varchar', length: 16, nullable: true })
  forgePreviewStatus!: string | null;

  @Column({ name: 'forge_preview_phase', type: 'varchar', length: 32, nullable: true })
  forgePreviewPhase!: string | null;

  @Column({ name: 'forge_preview_percent', type: 'smallint', nullable: true })
  forgePreviewPercent!: number | null;

  @Column({ name: 'forge_preview_last_error', type: 'text', nullable: true })
  forgePreviewLastError!: string | null;

  @Column({ name: 'forge_preview_result', type: 'jsonb', nullable: true })
  forgePreviewResult!: Record<string, unknown> | null;

  @OneToMany(() => ChatMessageEntity, (m) => m.conversation)
  messages?: ChatMessageEntity[];

  @ManyToOne(() => ChatIntegrationBatchEntity, (b) => b.conversations, { nullable: true })
  @JoinColumn({ name: 'integration_batch_id' })
  integrationBatch?: ChatIntegrationBatchEntity | null;
}
