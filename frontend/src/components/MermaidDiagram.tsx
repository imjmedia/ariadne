/**
 * Renders Mermaid diagrams inside chat markdown (erDiagram, flowchart, etc.).
 */
import { useEffect, useId, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { MermaidZoomViewport } from './MermaidZoomViewport';

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

export function MermaidDiagram({ chart, className = '' }: MermaidDiagramProps) {
  const reactId = useId().replace(/:/g, '');
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!chart.trim()) {
      setSvg(null);
      setError(null);
      return;
    }

    void (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'neutral',
          securityLevel: 'strict',
          er: { useMaxWidth: true },
        });
        const id = `mermaid-${reactId}`;
        const { svg: rendered } = await mermaid.render(id, chart.trim());
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setSvg(null);
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, reactId]);

  if (error) {
    return (
      <pre className={cn('my-2 overflow-x-auto rounded bg-muted p-2 font-mono text-xs', className)}>
        {chart}
      </pre>
    );
  }

  return (
    <>
      <div
        className={cn(
          'group relative my-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]',
          className,
        )}
      >
        {svg ? (
          <>
            <MermaidZoomViewport svg={svg} className="max-h-[min(420px,50vh)] p-2" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="absolute right-2 top-2 z-20 h-8 gap-1.5 rounded-lg bg-[var(--background)]/90 px-2.5 text-xs shadow-sm backdrop-blur-sm"
              onClick={() => setFullscreenOpen(true)}
            >
              <Maximize2 className="size-3.5 shrink-0" aria-hidden />
              Ver a pantalla completa
            </Button>
          </>
        ) : (
          <div
            className="flex h-28 items-center justify-center text-xs text-[var(--foreground-muted)]"
            aria-busy="true"
          >
            Renderizando diagrama…
          </div>
        )}
      </div>

      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent
          showCloseButton
          className="flex h-[min(96dvh,960px)] w-[min(96vw,1400px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
        >
          <DialogHeader className="shrink-0 border-b border-[var(--border)] px-5 py-4 text-left">
            <DialogTitle>Diagrama</DialogTitle>
            <DialogDescription className="sr-only">
              Vista ampliada del diagrama Mermaid. Pinch o Ctrl+rueda para zoom; arrastra para mover.
            </DialogDescription>
          </DialogHeader>
          {svg ? (
            <MermaidZoomViewport
              svg={svg}
              className="min-h-0 flex-1"
              showZoomHint
              showReset
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
