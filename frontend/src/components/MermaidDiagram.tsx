/**
 * Renders Mermaid diagrams inside chat markdown (erDiagram, flowchart, etc.).
 */
import { useEffect, useId, useRef, useState } from 'react';

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

export function MermaidDiagram({ chart, className = '' }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reactId = useId().replace(/:/g, '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const el = containerRef.current;
    if (!el || !chart.trim()) return;

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
        const { svg } = await mermaid.render(id, chart.trim());
        if (!cancelled && el) {
          el.innerHTML = svg;
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
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
      <pre className={`my-2 rounded bg-muted p-2 text-xs font-mono overflow-x-auto ${className}`}>
        {chart}
      </pre>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`my-3 overflow-x-auto [&_svg]:max-w-full ${className}`}
      aria-label="Diagrama Mermaid"
    />
  );
}
