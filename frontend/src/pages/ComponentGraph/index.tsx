/**
 * @fileoverview Legacy Impact Explorer — árbol de dependencias con scores.
 * Reemplaza al antiguo canvas visual de nodos (React Flow).
 * Muestra impacto legacy de componentes y funciones como árbol expandible
 * con indicadores de riesgo y cobertura de tests.
 */
import { useState, useCallback } from 'react';
import { MagnifyingGlass, CaretDown, CaretRight, Warning, ShieldCheck, FileText } from '@phosphor-icons/react';

// ── Tipos ──────────────────────────────────────────

interface DependentNode {
  name: string;
  labels: string;
  children?: DependentNode[];
}

interface LegacyImpactData {
  nodeName: string;
  dependents: number;
  files: string[];
  breakingRisk: 'low' | 'medium' | 'high';
}

interface ComponentGraphNode {
  name: string;
  type: string;
  dependents: string[];
}

// ── Componentes ────────────────────────────────────

function RiskBadge({ risk }: { risk: string }) {
  if (risk === 'high') return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Alto</span>;
  if (risk === 'medium') return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Medio</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Bajo</span>;
}

function TreeItem({ name, label, depth = 0, hasTests, children }: {
  name: string;
  label: string;
  depth: number;
  hasTests?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(depth < 1);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-[color-mix(in_oklch,var(--foreground)_4%,var(--card))]"
      >
        {children ? (
          open ? <CaretDown weight="fill" className="size-3 shrink-0 text-[var(--foreground-muted)]" /> : <CaretRight weight="fill" className="size-3 shrink-0 text-[var(--foreground-muted)]" />
        ) : (
          <span className="size-3 shrink-0" />
        )}
        <span className="font-mono text-sm">{name}</span>
        <span className="text-xs text-[var(--foreground-muted)]">{label}</span>
        {hasTests === false && <Warning weight="fill" className="size-3.5 text-amber-500" title="Sin tests" />}
      </button>
      {open && children && <div className="ml-4 border-l border-[var(--border)] pl-2">{children}</div>}
    </div>
  );
}

function ImpactCard({ data, graphData }: { data: LegacyImpactData; graphData: ComponentGraphNode[] }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-mono text-lg font-semibold">{data.nodeName}</h3>
          <p className="text-sm text-[var(--foreground-muted)]">
            {data.dependents} dependente{data.dependents !== 1 ? 's' : ''}
          </p>
        </div>
        <RiskBadge risk={data.breakingRisk} />
      </div>

      <div className="mb-3 flex gap-4 text-sm">
        <div className="flex items-center gap-1">
          <ShieldCheck weight="fill" className="size-4 text-[var(--primary)]" />
          <span>Impacto: <strong>{data.breakingRisk === 'high' ? 'ALTO' : data.breakingRisk === 'medium' ? 'MEDIO' : 'BAJO'}</strong></span>
        </div>
      </div>

      {data.files.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
            Archivos dependientes
          </h4>
          <div className="space-y-1">
            {data.files.map((file) => (
              <div key={file} className="flex items-center gap-2 rounded-md bg-[color-mix(in_oklch,var(--foreground)_3%,var(--card))] px-2.5 py-1.5 text-sm">
                <FileText className="size-3.5 shrink-0 text-[var(--foreground-muted)]" />
                <code className="flex-1 truncate text-xs">{file}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      {graphData.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
            Dependencias del componente
          </h4>
          <div className="max-h-48 space-y-0.5 overflow-y-auto">
            {graphData.map((dep) => (
              <TreeItem key={dep.name} name={dep.name} label={dep.type} depth={0}>
                {dep.dependents.length > 0 && (
                  <div className="py-1">
                    {dep.dependents.map((d) => (
                      <TreeItem key={d} name={d} label="dependiente" depth={1} />
                    ))}
                  </div>
                )}
              </TreeItem>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Página principal ───────────────────────────────

export function ComponentGraphExplorer() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [impactData, setImpactData] = useState<LegacyImpactData | null>(null);
  const [graphData, setGraphData] = useState<ComponentGraphNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setImpactData(null);
    setGraphData([]);

    try {
      // Llamar a get_legacy_impact via API
      const ingestUrl = (window as any).__INGEST_URL__ || '/api';
      const res = await fetch(
        `${ingestUrl}/api/internal/graph/impact/${encodeURIComponent(trimmed)}`,
        { signal: AbortSignal.timeout(15_000) },
      );

      if (res.status === 404) {
        setError(`"${trimmed}" no encontrado en el grafo. Verifica el nombre o ejecuta sync del repositorio.`);
        return;
      }
      if (!res.ok) {
        setError(`Error HTTP ${res.status}`);
        return;
      }

      const payload = await res.json() as {
        nodeId: string;
        dependents: Array<{ name?: unknown }>;
      };

      const dependents = (payload.dependents ?? [])
        .map((d) => String(d.name ?? ''))
        .filter(Boolean);

      setImpactData({
        nodeName: trimmed,
        dependents: dependents.length,
        files: dependents.slice(0, 20),
        breakingRisk: dependents.length > 10 ? 'high' : dependents.length > 3 ? 'medium' : 'low',
      });

      // También obtener grafo de componentes si es posible
      try {
        const graphRes = await fetch(
          `${ingestUrl}/api/internal/graph/component/${encodeURIComponent(trimmed)}`,
          { signal: AbortSignal.timeout(10_000) },
        );
        if (graphRes.ok) {
          const graphPayload = await graphRes.json() as {
            rows?: Array<{ name?: string; type?: string }>;
          };
          const rows = graphPayload.rows ?? [];
          setGraphData(
            rows.map((r) => ({
              name: r.name ?? '',
              type: r.type ?? 'Component',
              dependents: [],
            })),
          );
        }
      } catch {
        // Graph component es best-effort
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Grafo de Impacto Legacy</h1>
        <p className="mt-1 text-sm text-[var(--foreground-muted)]">
          Busca un componente o función para ver sus dependencias y riesgo de ruptura.
        </p>
      </div>

      {/* Buscador */}
      <div className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Ej: processClaim, calculatePremium, Header..."
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Resultado */}
      {impactData && <ImpactCard data={impactData} graphData={graphData} />}

      {/* Estado vacío */}
      {!loading && !error && !impactData && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShareNetworkIcon className="mb-4 size-12 text-[var(--foreground-muted)] opacity-30" />
          <p className="text-sm text-[var(--foreground-muted)]">
            Busca un componente o función para ver su impacto legacy
          </p>
        </div>
      )}
    </div>
  );
}

/** Icono inline de ShareNetwork (Phosphor no exporta como componente directo fácil). */
function ShareNetworkIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 256 256" fill="currentColor">
      <path d="M176,160a39.89,39.89,0,0,0-28.28,11.72L103.79,141.3a40,40,0,0,0,0-26.6l43.93-30.42A40,40,0,1,0,144,64a42.31,42.31,0,0,0,.81,8.08L100.88,102.5a40,40,0,1,0,0,51l43.93,30.42A42.31,42.31,0,0,0,144,192a40,40,0,1,0,32-32Zm0-128a16,16,0,1,1-16,16A16,16,0,0,1,176,32ZM64,144a16,16,0,1,1,16-16A16,16,0,0,1,64,144Zm112,48a16,16,0,1,1,16-16A16,16,0,0,1,176,192Z" />
    </svg>
  );
}
