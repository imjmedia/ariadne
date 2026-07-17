/**
 * @fileoverview Freshness / sync status for projects and repos (MCP get_sync_status, Gate 2 preflight).
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RepositoryEntity } from '../repositories/entities/repository.entity';
import { SyncJob } from '../repositories/entities/sync-job.entity';
import { ProjectRepositoryEntity } from '../repositories/entities/project-repository.entity';
import { ProjectEntity } from './entities/project.entity';

export type SyncStatusLevel = 'up_to_date' | 'syncing' | 'stale' | 'never_synced';

export interface SyncStatusJobDetail {
  id: string;
  repositoryId: string;
  type: SyncJob['type'];
  status: SyncJob['status'];
  startedAt: string;
  finishedAt: string | null;
  commitSha?: string;
}

export interface SyncStatusRepoSlice {
  id: string;
  repoSlug: string;
  lastSyncAt: string | null;
  lastCommitSha: string | null;
  stale: boolean;
  status: RepositoryEntity['status'];
}

export interface SyncStatusResponse {
  status: SyncStatusLevel;
  lastSync: string | null;
  lastCommitSha: string | null;
  stale: boolean;
  staleAfterHours: number;
  recommendation: string | null;
  details: SyncStatusJobDetail[];
  repositories: SyncStatusRepoSlice[];
}

function staleAfterHours(): number {
  const raw = process.env.SYNC_STALE_HOURS?.trim();
  const n = raw ? parseInt(raw, 10) : 72;
  if (!Number.isFinite(n) || n < 1) return 72;
  return Math.min(n, 720);
}

function isStaleDate(lastSyncAt: Date | null, hours: number): boolean {
  if (!lastSyncAt) return true;
  return Date.now() - lastSyncAt.getTime() > hours * 3600_000;
}

@Injectable()
export class SyncStatusService {
  constructor(
    @InjectRepository(RepositoryEntity)
    private readonly repoRepo: Repository<RepositoryEntity>,
    @InjectRepository(SyncJob)
    private readonly jobsRepo: Repository<SyncJob>,
    @InjectRepository(ProjectRepositoryEntity)
    private readonly projectReposRepo: Repository<ProjectRepositoryEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
  ) {}

  /** Resolve project UUID from project id or repository id (roots[].id). */
  async resolveProjectId(projectOrRepoId: string): Promise<string | null> {
    const id = projectOrRepoId.trim();
    if (!id) return null;
    const project = await this.projectRepo.findOne({ where: { id } });
    if (project) return id;
    const link = await this.projectReposRepo.findOne({ where: { repoId: id } });
    if (link?.projectId) return link.projectId;
    const repo = await this.repoRepo.findOne({ where: { id } });
    if (repo) {
      const links = await this.projectReposRepo.find({ where: { repoId: id }, take: 1 });
      return links[0]?.projectId ?? null;
    }
    return null;
  }

  async getStatusForProjectOrRepo(projectOrRepoId: string): Promise<SyncStatusResponse> {
    const hours = staleAfterHours();
    let projectId = await this.resolveProjectId(projectOrRepoId);
    let repos: RepositoryEntity[] = [];

    if (projectId) {
      const links = await this.projectReposRepo.find({
        where: { projectId },
        relations: ['repository'],
      });
      repos = links.map((l) => l.repository).filter(Boolean) as RepositoryEntity[];
    } else {
      const repo = await this.repoRepo.findOne({ where: { id: projectOrRepoId.trim() } });
      if (repo) repos = [repo];
    }

    if (repos.length === 0) {
      return {
        status: 'never_synced',
        lastSync: null,
        lastCommitSha: null,
        stale: true,
        staleAfterHours: hours,
        recommendation: 'Repository or project not found; verify projectId with list_known_projects.',
        details: [],
        repositories: [],
      };
    }

    const repoIds = repos.map((r) => r.id);
    const running = await this.jobsRepo.find({
      where: { repositoryId: In(repoIds), status: In(['queued', 'running']) },
      order: { startedAt: 'DESC' },
      take: 20,
    });

    const recentJobs = await this.jobsRepo.find({
      where: { repositoryId: In(repoIds) },
      order: { startedAt: 'DESC' },
      take: 15,
    });

    const repoSlices: SyncStatusRepoSlice[] = repos.map((r) => ({
      id: r.id,
      repoSlug: r.repoSlug,
      lastSyncAt: r.lastSyncAt?.toISOString() ?? null,
      lastCommitSha: r.lastCommitSha,
      stale: r.status !== 'ready' || isStaleDate(r.lastSyncAt, hours),
      status: r.status,
    }));

    const anySyncing = running.length > 0 || repos.some((r) => r.status === 'syncing');
    const anyStale = repoSlices.some((s) => s.stale);
    const lastSyncMs = repos
      .map((r) => r.lastSyncAt?.getTime() ?? 0)
      .reduce((a, b) => Math.max(a, b), 0);
    const lastSync = lastSyncMs > 0 ? new Date(lastSyncMs).toISOString() : null;
    const lastCommitSha =
      repos.find((r) => r.lastSyncAt?.getTime() === lastSyncMs)?.lastCommitSha ??
      repos[0]?.lastCommitSha ??
      null;

    let status: SyncStatusLevel = 'up_to_date';
    if (!lastSync) status = 'never_synced';
    else if (anySyncing) status = 'syncing';
    else if (anyStale) status = 'stale';

    const stale = status === 'never_synced' || status === 'stale';
    let recommendation: string | null = null;
    if (anySyncing) recommendation = 'Wait for sync jobs to finish before trusting the graph.';
    else if (stale) recommendation = 'Run full resync on stale repositories before Gate 2 / large refactors.';

    const details: SyncStatusJobDetail[] = recentJobs.map((j) => ({
      id: j.id,
      repositoryId: j.repositoryId,
      type: j.type,
      status: j.status,
      startedAt: j.startedAt.toISOString(),
      finishedAt: j.finishedAt?.toISOString() ?? null,
      commitSha:
        typeof (j.payload as Record<string, unknown> | null)?.commitSha === 'string'
          ? ((j.payload as Record<string, unknown>).commitSha as string)
          : undefined,
    }));

    return {
      status,
      lastSync,
      lastCommitSha,
      stale,
      staleAfterHours: hours,
      recommendation,
      details,
      repositories: repoSlices,
    };
  }

  /** Used by validate_change_plan unless CHANGE_PLAN_ALLOW_STALE=1 */
  isStaleBlocked(): boolean {
    const v = process.env.CHANGE_PLAN_ALLOW_STALE?.trim().toLowerCase();
    return !(v === '1' || v === 'true' || v === 'yes');
  }
}
