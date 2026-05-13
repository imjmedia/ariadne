/**
 * @fileoverview Controlador para encolar sync (full), resync (borrar grafo + sync) y resync solo por proyecto.
 */
import { Body, Controller, Param, Post } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { JobsOptions, Queue } from 'bullmq';
import { SYNC_QUEUE } from './sync.processor';
import { SyncService } from './sync.service';

/** Timeout BullMQ (ms) para full-sync; `0` o vacío = sin límite. Ver `BULL_SYNC_JOB_TIMEOUT_MS` en compose/.env. */
function resolveSyncJobTimeoutMs(): number | undefined {
  const raw = process.env.BULL_SYNC_JOB_TIMEOUT_MS?.trim();
  if (raw === undefined || raw === '' || raw === '0') return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** BullMQ admite `timeout` en runtime; los tipos de `JobsOptions` en algunas versiones no lo exponen. */
function fullSyncAddOptions(): JobsOptions & { timeout?: number } {
  const opts: JobsOptions & { timeout?: number } = { removeOnComplete: { count: 100 } };
  const timeout = resolveSyncJobTimeoutMs();
  if (timeout != null) opts.timeout = timeout;
  return opts;
}

/** Endpoints POST /repositories/:id/sync, :id/resync, :id/resync-for-project. */
@Controller('repositories')
export class SyncController {
  constructor(
    @InjectQueue(SYNC_QUEUE) private readonly syncQueue: Queue,
    private readonly syncService: SyncService,
  ) {}

  private async enqueueFullSync(data: {
    repositoryId: string;
    syncJobId: string;
    onlyProjectId?: string;
  }): Promise<void> {
    try {
      await this.syncQueue.add('full-sync', data, fullSyncAddOptions());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.syncService.markSyncJobEnqueueFailed(data.repositoryId, data.syncJobId, msg);
      throw err;
    }
  }

  /**
   * Encola un job de sync completo para el repositorio (todos los proyectos del repo).
   */
  @Post(':id/sync')
  async triggerSync(@Param('id') id: string) {
    const syncJob = await this.syncService.createQueuedJob(id);
    await this.enqueueFullSync({ repositoryId: id, syncJobId: syncJob.id });
    return { jobId: syncJob.id, queued: true };
  }

  /**
   * Borra solo los nodos Falkor de este repo (por participación projectId+repoId) y encola sync completo.
   */
  @Post(':id/resync')
  async resync(@Param('id') id: string) {
    const { deletedNodes } = await this.syncService.clearRepositoryForResync(id);
    const syncJob = await this.syncService.createQueuedJob(id);
    await this.enqueueFullSync({ repositoryId: id, syncJobId: syncJob.id });
    return { jobId: syncJob.id, queued: true, deletedNodes };
  }

  /**
   * Resync solo para un proyecto: borra nodos (projectId, repoId) y encola sync que solo escribe en ese proyecto.
   * Body: { projectId: string }.
   */
  @Post(':id/resync-for-project')
  async resyncForProject(
    @Param('id') id: string,
    @Body() body: { projectId: string },
  ) {
    const projectId = body?.projectId?.trim();
    if (!projectId) {
      return { jobId: null, queued: false, error: 'projectId required' };
    }
    const syncJob = await this.syncService.createQueuedJob(id);
    await this.enqueueFullSync({
      repositoryId: id,
      syncJobId: syncJob.id,
      onlyProjectId: projectId,
    });
    return { jobId: syncJob.id, queued: true };
  }
}
