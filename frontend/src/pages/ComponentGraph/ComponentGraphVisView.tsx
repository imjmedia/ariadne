/**
 * Grafo de componente con vis-network (fuerzas, zoom, pan). Clic en nodo periférico → expandir vecindario.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { DataSet } from 'vis-data';
import { Network, type Options } from 'vis-network';
import 'vis-network/styles/vis-network.css';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  type GraphEdge,
  type GraphNode,
  edgeColorForKind,
  filterValidEdges,
  labelFor,
  resolveFocalNode,
} from './componentGraphFlow';

const VIS_NETWORK_OPTIONS = {
  autoResize: true,
  physics: {
    enabled: true,
    solver: 'forceAtlas2Based' as const,
    forceAtlas2Based: {
      gravitationalConstant: -42,
      centralGravity: 0.012,
      springLength: 115,
      springConstant: 0.055,
      damping: 0.55,
      avoidOverlap: 0.65,
    },
    maxVelocity: 48,
    minVelocity: 0.75,
    stabilization: {
      enabled: true,
      iterations: 380,
      updateInterval: 20,
      fit: true,
    },
  },
  layout: { improvedLayout: true },
  edges: { smooth: true },
  interaction: {
    hover: true,
    tooltipDelay: 140,
    zoomView: true,
    dragView: true,
    dragNodes: true,
    zoomSpeed: 1,
    navigationButtons: true,
    keyboard: true,
    multiselect: false,
  },
} satisfies Options;

/** Colores hex (el canvas de vis no resuelve CSS variables; alineados a vars.css oscuro). */
const NODE_FONT = {
  size: 13,
  color: '#e2e8f0',
  face: 'Inter, ui-sans-serif, system-ui, sans-serif',
} as const;

const PERIPHERAL_NODE_COLOR = {
  border: '#64748b',
  background: '#1e293b',
  highlight: { border: '#3b82f6', background: '#334155' },
  hover: { border: '#60a5fa', background: '#334155' },
};

const FOCAL_NODE_COLOR = {
  border: '#3b82f6',
  background: '#172554',
  highlight: { border: '#60a5fa', background: '#1e3a5f' },
  hover: { border: '#60a5fa', background: '#1e3a5f' },
};

const visShellClass = cn(
  'component-graph-vis flex min-h-[560px] w-full flex-col overflow-hidden rounded-2xl border border-[var(--border)]',
  'bg-[var(--card)] shadow-sm transition-shadow duration-[var(--transition-base)] hover:shadow-md',
);

const visHeaderBarClass = cn(
  'border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_32%,var(--card))] px-4 py-3',
);

/** Leyenda de aristas del índice Falkor. */
function GraphEdgeLegend({ indexedMode }: { indexedMode?: boolean }) {
  if (indexedMode) {
    return (
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[var(--border)]',
          'bg-[color-mix(in_oklch,var(--muted)_22%,var(--card))] px-4 py-2.5 text-xs text-[var(--foreground-muted)]',
        )}
        role="note"
        aria-label="Leyenda del grafo indexado"
      >
        <span>
          Cada arista es una relación real del índice Falkor (<span className="font-mono">IMPORTS</span>,{' '}
          <span className="font-mono">CONTAINS</span>, <span className="font-mono">CALLS</span>,{' '}
          <span className="font-mono">RENDERS</span>, …). Sin capa C4.
        </span>
      </div>
    );
  }
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[var(--border)]',
        'bg-[color-mix(in_oklch,var(--muted)_22%,var(--card))] px-4 py-2.5 text-xs text-[var(--foreground-muted)]',
      )}
      role="note"
      aria-label="Leyenda de tipos de arista"
    >
      <span className="inline-flex items-center gap-2">
        <span className="inline-block h-0.5 w-8 shrink-0 rounded-full bg-blue-500" aria-hidden />
        <span>
          <span className="font-medium text-[var(--foreground)]">depends</span>{' '}
          <span className="text-[var(--foreground-subtle)]">(animada)</span>
        </span>
      </span>
      <span className="inline-flex items-center gap-2">
        <span
          className="inline-block h-0.5 w-8 shrink-0 rounded-full border border-dashed border-amber-500/80 bg-amber-500"
          aria-hidden
        />
        <span className="font-medium text-[var(--foreground)]">legacy_impact</span>
      </span>
    </div>
  );
}

type Props = {
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  graphKey: string;
  projectId: string;
  expanding: boolean;
  rootFocalName: string;
  /** true = relaciones crudas del índice; false = subgrafo de componente (depends / legacy_impact). */
  indexedMode?: boolean;
  onExpandNode: (componentName: string) => void | Promise<void>;
};

export function ComponentGraphVisView({
  graphNodes,
  graphEdges,
  graphKey,
  projectId,
  expanding,
  rootFocalName,
  indexedMode = true,
  onExpandNode,
}: Props) {
  const [visLayoutGeneration, setVisLayoutGeneration] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const visNetworkRef = useRef<Network | null>(null);

  const validEdges = useMemo(() => filterValidEdges(graphNodes, graphEdges), [graphNodes, graphEdges]);
  const focalId = useMemo(() => {
    const f = resolveFocalNode(graphNodes, graphEdges, rootFocalName);
    return f?.id ?? null;
  }, [graphNodes, graphEdges, rootFocalName]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || graphNodes.length === 0) return;

    const visNodes = new DataSet(
      graphNodes.map((n) => {
        const isFocal = focalId !== null && n.id === focalId;
        return {
          id: n.id,
          label: `${labelFor(n)} (${n.kind})`,
          shape: 'box' as const,
          font: NODE_FONT,
          color: isFocal ? FOCAL_NODE_COLOR : PERIPHERAL_NODE_COLOR,
          borderWidth: isFocal ? 3 : 2,
        };
      }),
    );

    const visEdges = new DataSet(
      validEdges.map((e, i) => {
        const style = edgeColorForKind(e.kind);
        return {
          id: `e-${i}-${e.source}-${e.target}-${e.kind}`,
          from: e.source,
          to: e.target,
          arrows: 'to' as const,
          color: { color: style.color, highlight: style.highlight } as const,
          dashes: style.dashes,
          label: e.kind,
          font: { size: 10, align: 'middle' as const, color: '#94a3b8' },
        };
      }),
    );

    const network = new Network(el, { nodes: visNodes, edges: visEdges }, { ...VIS_NETWORK_OPTIONS });
    visNetworkRef.current = network;

    const onStabilized = () => {
      network.setOptions({ physics: { enabled: false } });
    };
    network.on('stabilizationIterationsDone', onStabilized);

    const onClick = (params: { nodes: string[] }) => {
      if (indexedMode || expanding || !projectId.trim()) return;
      const id = params.nodes[0];
      if (id == null || focalId == null || id === focalId) return;
      const gn = graphNodes.find((n) => n.id === id);
      if (!gn) return;
      const cn = typeof gn.name === 'string' && gn.name.trim() ? gn.name.trim() : labelFor(gn);
      if (!cn) return;
      void onExpandNode(cn);
    };
    network.on('click', onClick);

    const fit = () => {
      network.fit({ animation: { duration: 320, easingFunction: 'easeInOutQuad' } });
    };
    const raf = requestAnimationFrame(() => requestAnimationFrame(fit));

    const ro = new ResizeObserver(() => {
      network.redraw();
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      network.off('stabilizationIterationsDone', onStabilized);
      network.off('click', onClick);
      network.destroy();
      visNetworkRef.current = null;
    };
  }, [graphNodes, validEdges, graphKey, focalId, projectId, expanding, indexedMode, onExpandNode, visLayoutGeneration]);

  if (graphNodes.length === 0) {
    return (
      <div className={visShellClass}>
        <div className={visHeaderBarClass}>
          <h3 className="text-sm font-semibold tracking-tight text-[var(--foreground)]">Grafo indexado (vis-network)</h3>
          <p className="mt-1 text-xs leading-relaxed text-[var(--foreground-muted)]">
            Relaciones reales del índice Falkor para el alcance elegido (mismo <span className="font-mono">projectId</span>{' '}
            / <span className="font-mono">repoId</span> que el sync).
          </p>
        </div>
        <GraphEdgeLegend indexedMode />
        <div
          className={cn(
            'flex flex-1 flex-col items-center justify-center px-6 py-12 text-center',
            'bg-[color-mix(in_oklch,var(--muted)_45%,transparent)]',
          )}
        >
          <div
            className={cn(
              'max-w-md rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-8 shadow-sm',
            )}
          >
            <p className="m-0 text-sm font-medium text-[var(--foreground)]">Aún no hay grafo cargado</p>
            <p className="mt-2 text-xs leading-relaxed text-[var(--foreground-muted)]">
              Elige un proyecto o repositorio indexado arriba y pulsa{' '}
              <span className="font-medium text-[var(--foreground)]">Cargar grafo indexado</span>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(visShellClass, 'h-[560px] min-h-0')}>
      <div className={cn(visHeaderBarClass, 'flex flex-wrap items-start gap-3')}>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-xl border-[var(--border)] bg-[var(--card)] text-xs"
            onClick={() => {
              visNetworkRef.current?.fit({
                animation: { duration: 380, easingFunction: 'easeInOutQuad' },
              });
            }}
          >
            Encuadrar
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-xl border-[var(--border)] bg-[var(--card)] text-xs"
            onClick={() => setVisLayoutGeneration((n) => n + 1)}
          >
            Autolayout (re-física)
          </Button>
        </div>
        <div className="min-w-0 max-w-[min(100%,520px)] flex-1 text-xs leading-relaxed text-[var(--foreground-muted)]">
          <p className="mb-0.5 font-semibold text-[var(--foreground)]">
            {indexedMode ? 'Relaciones indexadas' : 'Subgrafo de componente'}
          </p>
          {expanding ? (
            <p className="mb-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">Fusionando vecindario…</p>
          ) : null}
          <p>
            {indexedMode
              ? 'Nodos y aristas tal cual en Falkor tras el sync/resync. Usa zoom/pan o Encuadrar.'
              : 'Clic en un nodo periférico para ampliar (depth 1).'}
          </p>
        </div>
      </div>
      <GraphEdgeLegend indexedMode={indexedMode} />
      <div ref={containerRef} className="min-h-0 w-full flex-1 touch-none bg-[var(--background)]" />
    </div>
  );
}
