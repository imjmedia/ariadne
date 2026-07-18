import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SYSTEM_SETTINGS_SINGLETON_ID } from '../system-settings.types';

@Entity('system_settings')
export class SystemSettingsEntity {
  @PrimaryColumn({ type: 'varchar', length: 32, default: SYSTEM_SETTINGS_SINGLETON_ID })
  id!: string;

  @Column({ name: 'cors_origin', type: 'varchar', length: 1024, nullable: true })
  corsOrigin!: string | null;

  @Column({ name: 'email_otp', type: 'varchar', length: 320, nullable: true })
  emailOtp!: string | null;

  @Column({ name: 'sso_url', type: 'varchar', length: 512, nullable: true })
  ssoUrl!: string | null;

  @Column({ name: 'web_app_host', type: 'varchar', length: 256, nullable: true })
  webAppHost!: string | null;

  @Column({ name: 'smtp_host', type: 'varchar', length: 256, nullable: true })
  smtpHost!: string | null;

  @Column({ name: 'smtp_port', type: 'int', nullable: true })
  smtpPort!: number | null;

  @Column({ name: 'smtp_user', type: 'varchar', length: 320, nullable: true })
  smtpUser!: string | null;

  @Column({ name: 'smtp_pass_encrypted', type: 'text', nullable: true })
  smtpPassEncrypted!: string | null;

  @Column({ name: 'smtp_from', type: 'varchar', length: 320, nullable: true })
  smtpFrom!: string | null;

  @Column({ name: 'falkor_shard_by_project', type: 'boolean', nullable: true })
  falkorShardByProject!: boolean | null;

  @Column({ name: 'falkor_shard_by_domain', type: 'boolean', nullable: true })
  falkorShardByDomain!: boolean | null;

  @Column({ name: 'falkor_auto_domain_overflow', type: 'boolean', nullable: true })
  falkorAutoDomainOverflow!: boolean | null;

  @Column({ name: 'falkor_graph_node_soft_limit', type: 'int', nullable: true })
  falkorGraphNodeSoftLimit!: number | null;

  @Column({ name: 'falkor_debug_cypher', type: 'boolean', nullable: true })
  falkorDebugCypher!: boolean | null;

  @Column({ name: 'metrics_enabled', type: 'boolean', nullable: true })
  metricsEnabled!: boolean | null;

  @Column({ name: 'chat_telemetry_log', type: 'boolean', nullable: true })
  chatTelemetryLog!: boolean | null;

  @Column({ name: 'chat_two_phase', type: 'boolean', nullable: true })
  chatTwoPhase!: boolean | null;

  @Column({ name: 'modification_plan_max_files', type: 'int', nullable: true })
  modificationPlanMaxFiles!: number | null;

  @Column({ name: 'updated_by', type: 'varchar', length: 64, nullable: true })
  updatedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
