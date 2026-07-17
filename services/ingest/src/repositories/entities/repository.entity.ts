/**
 * @fileoverview Entidad repositories: repo Bitbucket/GitHub (provider, projectKey, repoSlug, credentialsRef, webhook secret cifrado).
 */
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SyncJob } from './sync-job.entity';
import { IndexedFile } from './indexed-file.entity';
import { ProjectRepositoryEntity } from './project-repository.entity';
import { EmbeddingSpaceEntity } from '../../embedding/entities/embedding-space.entity';
import type { IndexIncludeRules } from '../../providers/index-include-rules';

export type RepositoryStatus = 'pending' | 'syncing' | 'ready' | 'error';

@Entity('repositories')
export class RepositoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  provider!: string;

  @Column({ name: 'project_key', type: 'varchar', length: 256 })
  projectKey!: string;

  @Column({ name: 'repo_slug', type: 'varchar', length: 256 })
  repoSlug!: string;

  @Column({ name: 'default_branch', type: 'varchar', length: 256, default: 'main' })
  defaultBranch!: string;

  @Column({ name: 'credentials_ref', type: 'varchar', length: 512, nullable: true })
  credentialsRef!: string | null;

  /** Webhook secret por repositorio (HMAC). Cifrado con CREDENTIALS_ENCRYPTION_KEY. */
  @Column({ name: 'webhook_secret_encrypted', type: 'varchar', length: 512, nullable: true, select: false })
  webhookSecretEncrypted!: string | null;

  @Column({ name: 'last_sync_at', type: 'timestamptz', nullable: true })
  lastSyncAt!: Date | null;

  /** Last processed commit SHA — webhook bridge for diff-based incremental sync */
  @Column({ name: 'last_commit_sha', type: 'varchar', length: 64, nullable: true })
  lastCommitSha!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status!: RepositoryStatus;

  /** Patrones de dominio inferidos en primera ingesta (componentPatterns, constNames). Por proyecto. */
  @Column({ name: 'domain_config', type: 'jsonb', nullable: true })
  domainConfig!: { componentPatterns?: string[]; constNames?: string[] } | null;

  /**
   * Alcance de indexado por repo. Null = todo el repo (filtro global `shouldSyncIndexPath`).
   * Si está definido: siempre raíz `package.json` + `*.json|js|ts|jsx|tsx` en raíz, más `entries`
   * (`path_prefix` o `file`). `entries: []` = solo esos archivos de raíz.
   */
  @Column({ name: 'index_include_rules', type: 'jsonb', nullable: true })
  indexIncludeRules!: IndexIncludeRules | null;

  /** Espacio vectorial activo para búsqueda RAG (query embedding + propiedad en Falkor). Null = legado `embedding` + EMBEDDING_PROVIDER. */
  @Column({ name: 'read_embedding_space_id', type: 'uuid', nullable: true })
  readEmbeddingSpaceId!: string | null;

  @ManyToOne(() => EmbeddingSpaceEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'read_embedding_space_id' })
  readEmbeddingSpace?: EmbeddingSpaceEntity | null;

  /**
   * Destino del job embed-index durante migración de modelo. Null = mismo que lectura (o legado).
   * Permite rellenar una propiedad nueva mientras la lectura sigue en la antigua.
   */
  @Column({ name: 'write_embedding_space_id', type: 'uuid', nullable: true })
  writeEmbeddingSpaceId!: string | null;

  @ManyToOne(() => EmbeddingSpaceEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'write_embedding_space_id' })
  writeEmbeddingSpace?: EmbeddingSpaceEntity | null;

  @OneToMany(() => ProjectRepositoryEntity, (pr) => pr.repository)
  projectRepos!: ProjectRepositoryEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => SyncJob, (job) => job.repository)
  syncJobs!: SyncJob[];

  @OneToMany(() => IndexedFile, (file) => file.repository)
  indexedFiles!: IndexedFile[];

  /** The Forge project UUID — POST /projects/:id/converge/trigger after successful index (brownfield). */
  @Column({ name: 'theforge_project_id', type: 'varchar', length: 64, nullable: true })
  theforgeProjectId!: string | null;

  /** Optional The Forge stage UUID (?stageId= on converge/trigger). */
  @Column({ name: 'theforge_stage_id', type: 'varchar', length: 64, nullable: true })
  theforgeStageId!: string | null;

  /** If true, converge/trigger body includes persist: true. */
  @Column({ name: 'theforge_converge_persist', type: 'boolean', default: false })
  theforgeConvergePersist!: boolean;

  /** off | full | incremental | all — when to call The Forge after sync. */
  @Column({ name: 'theforge_converge_trigger_mode', type: 'varchar', length: 16, default: 'off' })
  theforgeConvergeTriggerMode!: string;

  /** Persist MDD JSON after successful full sync (also auto when theforgeProjectId is set). */
  @Column({ name: 'auto_mdd_on_full_sync', type: 'boolean', default: false })
  autoMddOnFullSync!: boolean;

  /** Include *.spec.* / *.test.* in index for this repo. */
  @Column({ name: 'index_tests_enabled', type: 'boolean', default: false })
  indexTestsEnabled!: boolean;

  /** Bearer JWT for The Forge API. Encrypted with CREDENTIALS_ENCRYPTION_KEY. */
  @Column({
    name: 'theforge_service_token_encrypted',
    type: 'varchar',
    length: 1024,
    nullable: true,
    select: false,
  })
  theforgeServiceTokenEncrypted!: string | null;
}
