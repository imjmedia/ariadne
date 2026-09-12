/**
 * @fileoverview Historial de snapshots C4 y vista compare.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api';
import { formatC4ArchifyFailure } from '@/utils/c4-archify-error';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { C4DiagramLevel } from './C4DiagramViewer';

type SnapshotRow = {
  id: string;
  level: string;
  contentHash: string;
  createdAt: string;
};

export function C4SnapshotCompare({
  projectId,
  level,
}: {
  projectId: string;
  level: C4DiagramLevel;
}) {
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [diffHtml, setDiffHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.listC4Snapshots(projectId, level);
      setSnapshots(res.snapshots);
      if (res.snapshots.length >= 2) {
        setFromId(res.snapshots[1]!.id);
        setToId(res.snapshots[0]!.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [projectId, level]);

  useEffect(() => {
    void load();
  }, [load]);

  const compare = async () => {
    if (!fromId || !toId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.diffC4Snapshots(projectId, fromId, toId);
      setDiffHtml(res.archifyCompareHtml);
      if (!res.archifyCompareHtml) {
        setError(
          formatC4ArchifyFailure({
            htmlReady: false,
            archifyError: res.archifyCompareError,
            archifyBin: res.archifyBin,
            fallback: 'Diff JSON disponible pero sin HTML Archify compare.',
          }),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (snapshots.length < 2) {
    return (
      <p className="text-xs text-muted-foreground">
        Genera al menos dos snapshots para comparar cambios de topología.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] p-3">
      <p className="text-xs font-medium">Historial / comparar</p>
      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-xs space-y-1">
          <span className="text-muted-foreground">Desde</span>
          <select
            className="block rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs"
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
          >
            {snapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {new Date(s.createdAt).toLocaleString()} ({s.contentHash.slice(0, 8)})
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs space-y-1">
          <span className="text-muted-foreground">Hasta</span>
          <select
            className="block rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs"
            value={toId}
            onChange={(e) => setToId(e.target.value)}
          >
            {snapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {new Date(s.createdAt).toLocaleString()} ({s.contentHash.slice(0, 8)})
              </option>
            ))}
          </select>
        </label>
        <Button type="button" size="sm" disabled={loading} onClick={() => void compare()}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : 'Comparar'}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {diffHtml ? (
        <iframe
          title="C4 diff"
          srcDoc={diffHtml}
          className="w-full min-h-[420px] rounded-lg border border-[var(--border)]"
          sandbox="allow-scripts allow-same-origin"
        />
      ) : null}
    </div>
  );
}
