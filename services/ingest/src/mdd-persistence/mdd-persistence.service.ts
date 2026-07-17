/**
 * @fileoverview Build and persist MDD after full sync; expose latest snapshot API.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MddSnapshotEntity } from './entities/mdd-snapshot.entity';
import { RepositoryEntity } from '../repositories/entities/repository.entity';
import { ChatService } from '../chat/chat.service';

@Injectable()
export class MddPersistenceService {
  private readonly logger = new Logger(MddPersistenceService.name);

  constructor(
    @InjectRepository(MddSnapshotEntity)
    private readonly snapshots: Repository<MddSnapshotEntity>,
    @InjectRepository(RepositoryEntity)
    private readonly repos: Repository<RepositoryEntity>,
    private readonly chat: ChatService,
  ) {}

  shouldPersist(repo: RepositoryEntity): boolean {
    if (repo.autoMddOnFullSync) return true;
    if (repo.theforgeProjectId?.trim()) return true;
    const env = process.env.AUTO_MDD_ON_FULL_SYNC?.trim().toLowerCase();
    return env === '1' || env === 'true' || env === 'yes';
  }

  async persistAfterFullSync(
    repositoryId: string,
    projectId: string,
    commitSha: string | null,
  ): Promise<{ saved: boolean; snapshotId?: string }> {
    const repo = await this.repos.findOne({ where: { id: repositoryId } });
    if (!repo || !this.shouldPersist(repo)) {
      return { saved: false };
    }
    try {
      const mdd = await this.chat.buildMddEvidenceForRepository(
        repositoryId,
        projectId,
        'Brownfield baseline MDD (post full sync)',
        '',
        [],
        false,
      );
      const row = await this.snapshots.save(
        this.snapshots.create({
          repositoryId,
          projectId,
          commitSha,
          mddJson: mdd as unknown as Record<string, unknown>,
        }),
      );
      this.logger.log(`MDD snapshot ${row.id} for repo ${repositoryId} (${commitSha ?? 'no-sha'})`);
      return { saved: true, snapshotId: row.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`MDD persistence failed for ${repositoryId}: ${msg}`);
      return { saved: false };
    }
  }

  async getLatest(repositoryId: string): Promise<MddSnapshotEntity | null> {
    return this.snapshots.findOne({
      where: { repositoryId },
      order: { createdAt: 'DESC' },
    });
  }
}
