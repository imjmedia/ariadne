import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export const LLM_SETTINGS_SINGLETON_ID = 'default';

@Entity('llm_settings')
export class LlmSettingsEntity {
  @PrimaryColumn({ type: 'varchar', length: 32, default: LLM_SETTINGS_SINGLETON_ID })
  id!: string;

  @Column({ type: 'varchar', length: 32 })
  provider!: string;

  @Column({ name: 'api_key_encrypted', type: 'text', nullable: true })
  apiKeyEncrypted!: string | null;

  @Column({ name: 'base_url', type: 'varchar', length: 512, nullable: true })
  baseUrl!: string | null;

  @Column({ name: 'chat_model', type: 'varchar', length: 256, nullable: true })
  chatModel!: string | null;

  @Column({ name: 'orchestrator_chat_model', type: 'varchar', length: 256, nullable: true })
  orchestratorChatModel!: string | null;

  @Column({ type: 'float', nullable: true })
  temperature!: number | null;

  @Column({ name: 'embedding_provider', type: 'varchar', length: 32, nullable: true })
  embeddingProvider!: string | null;

  @Column({ name: 'embedding_model', type: 'varchar', length: 256, nullable: true })
  embeddingModel!: string | null;

  @Column({ name: 'embedding_dimension', type: 'int', nullable: true })
  embeddingDimension!: number | null;

  @Column({ type: 'jsonb', nullable: true })
  extras!: Record<string, unknown> | null;

  @Column({ name: 'http_referer', type: 'varchar', length: 512, nullable: true })
  httpReferer!: string | null;

  @Column({ name: 'app_title', type: 'varchar', length: 256, nullable: true })
  appTitle!: string | null;

  @Column({ name: 'updated_by', type: 'varchar', length: 64, nullable: true })
  updatedBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
