/**
 * Mapa repoId → estado del job activo (queued/running) con polling mientras haya jobs en curso.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api';
import type { SyncJobStatus } from '@/types';

const POLL_MS = 2000;

export function useActiveSyncJobStatuses(options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false;
  const [statusByRepoId, setStatusByRepoId] = useState<Map<string, SyncJobStatus>>(new Map());

  const refresh = useCallback(async () => {
    const jobs = await api.getActiveSyncJobs();
    const next = new Map<string, SyncJobStatus>();
    for (const j of jobs) {
      if (j.status === 'queued' || j.status === 'running') {
        next.set(j.repositoryId, j.status);
      }
    }
    setStatusByRepoId(next);
    return next;
  }, []);

  const setOptimistic = useCallback((repoId: string, status: SyncJobStatus) => {
    setStatusByRepoId((prev) => {
      const next = new Map(prev);
      next.set(repoId, status);
      return next;
    });
  }, []);

  const clearOptimistic = useCallback((repoId: string) => {
    setStatusByRepoId((prev) => {
      if (!prev.has(repoId)) return prev;
      const next = new Map(prev);
      next.delete(repoId);
      return next;
    });
  }, []);

  const displayStatus = useCallback(
    (repoId: string, fallback: string) => statusByRepoId.get(repoId) ?? fallback,
    [statusByRepoId],
  );

  useEffect(() => {
    if (!enabled) return;
    void refresh().catch(() => {});
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || statusByRepoId.size === 0) return;
    const t = setInterval(() => void refresh().catch(() => {}), POLL_MS);
    return () => clearInterval(t);
  }, [enabled, statusByRepoId.size, refresh]);

  return {
    statusByRepoId,
    hasActiveJobs: statusByRepoId.size > 0,
    refresh,
    setOptimistic,
    clearOptimistic,
    displayStatus,
  };
}
