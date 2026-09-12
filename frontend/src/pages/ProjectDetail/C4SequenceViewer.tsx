/**
 * @fileoverview Secuencia API Archify (Entrega 3.2).
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api';
import { formatC4ArchifyFailure } from '@/utils/c4-archify-error';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export function C4SequenceViewer({ projectId }: { projectId: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setHtml(await api.getC4SequenceHtml(projectId));
    } catch (e) {
      setHtml(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await api.generateC4Sequence(projectId);
      if (res.htmlReady) await load();
      else {
        setError(
          formatC4ArchifyFailure({
            htmlReady: false,
            archifyError: res.archifyError,
            archifyBin: res.archifyBin,
            fallback: 'Secuencia generada pero sin HTML Archify.',
          }),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }, [projectId, load]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="size-4 animate-spin" />
        Cargando secuencia API…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button type="button" size="sm" disabled={generating} onClick={() => void generate()}>
        {generating ? <Loader2 className="size-4 animate-spin" /> : 'Generar secuencia API'}
      </Button>
      {error ? <p className="text-xs text-destructive whitespace-pre-wrap">{error}</p> : null}
      {html ? (
        <iframe
          title="C4 Sequence"
          srcDoc={html}
          className="w-full min-h-[480px] rounded-xl border border-[var(--border)]"
          sandbox="allow-scripts allow-same-origin"
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          Flujo representativo Route → API → backend (Falkor). Requiere sync previo.
        </p>
      )}
    </div>
  );
}
