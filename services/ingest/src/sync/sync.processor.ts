/**
 * @fileoverview Worker BullMQ que procesa jobs de full sync.
 */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { SyncService } from './sync.service';

/** Nombre de la cola BullMQ para sync. */
export const SYNC_QUEUE = 'sync';

/** Duración del lock Redis del job: full sync puede tardar minutos (parse + Falkor + embed). Default BullMQ ~30s provoca "could not renew lock" / "Missing lock" al completar. */
const SYNC_LOCK_MS = parseInt(process.env.BULL_SYNC_LOCK_DURATION_MS ?? '', 10) || 30 * 60 * 1000;

/** Procesa jobs sync encolados (concurrency 1, limiter 2/min). */
@Processor(SYNC_QUEUE, {
  concurrency: 1,
  limiter: { max: 2, duration: 60_000 },
  lockDuration: SYNC_LOCK_MS,
  /** Menos agresivo que el default (~30s) para jobs largos; el lock ya cubre el stall window. */
  stalledInterval: Math.min(120_000, Math.max(60_000, Math.floor(SYNC_LOCK_MS / 4))),
})
export class SyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncProcessor.name);

  constructor(private readonly syncService: SyncService) {
    super();
  }

  /**
   * Procesa un job de sync: ejecuta runFullSync del SyncService para el repositorio indicado.
   * @param job - Job BullMQ con repositoryId, opcional syncJobId y opcional onlyProjectId (resync solo ese proyecto).
   * @returns jobId e indexed.
   */
  async process(
    job: Job<{
      repositoryId: string;
      syncJobId?: string;
      onlyProjectId?: string;
      triggeredByUserId?: string;
    }>,
  ): Promise<{ jobId: string; indexed: number }> {
    const { repositoryId, syncJobId, onlyProjectId, triggeredByUserId } = job.data;
    this.logger.log(
      `Processing sync job ${job.id} for repository ${repositoryId}${onlyProjectId ? ` (project ${onlyProjectId})` : ''}`,
    );
    try {
      const result = await this.syncService.runFullSync(repositoryId, syncJobId, {
        ...(onlyProjectId && { onlyProjectId }),
        ...(triggeredByUserId && { triggeredByUserId }),
      });
      this.logger.log(`Sync job ${job.id} completed — indexed ${result.indexed} files`);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Sync job ${job.id} failed: ${msg}`);
      throw err;
    }
  }
}
