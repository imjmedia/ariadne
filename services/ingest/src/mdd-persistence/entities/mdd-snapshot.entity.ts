/**
 * @fileoverview Persisted MDD JSON per repository sync (metadata only, not full source).
 */
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('repository_mdd_snapshots')
@Index(['repositoryId', 'createdAt'])
export class MddSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'repository_id', type: 'uuid' })
  repositoryId!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Column({ name: 'commit_sha', type: 'varchar', length: 64, nullable: true })
  commitSha!: string | null;

  @Column({ name: 'mdd_json', type: 'jsonb' })
  mddJson!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
