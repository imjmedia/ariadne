import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export const THEFORGE_INTEGRATION_SINGLETON_ID = 'default';

@Entity('theforge_integration_settings')
export class TheForgeIntegrationEntity {
  @PrimaryColumn({ type: 'varchar', length: 32, default: THEFORGE_INTEGRATION_SINGLETON_ID })
  id!: string;

  /** Opt-in global: sin esto, chat promotion y URL global no se usan. */
  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  @Column({ name: 'api_url', type: 'varchar', length: 512, nullable: true })
  apiUrl!: string | null;

  @Column({ name: 'service_token_encrypted', type: 'text', nullable: true })
  serviceTokenEncrypted!: string | null;

  @Column({ name: 'updated_by', type: 'varchar', length: 64, nullable: true })
  updatedBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
