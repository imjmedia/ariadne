/**
 * Explorador visual del grafo de componente: dependencias + impacto legacy (vis-network).
 * Alcance: proyecto / repo → graph-summary → GET /graph/component.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Info, Share2 } from 'lucide-react';
import { api } from '@/api';
import type { ScopeOption } from '@/lib/graphScope';
import { buildScopeOptions, extractComponentNames } from '@/lib/graphScope';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import { type GraphEdge, type GraphNode } from './componentGraphFlow';
import { mergeGraphEdges, mergeGraphNodes } from './graphMerge';
import { ComponentGraphDebugPanel } from './ComponentGraphDebugPanel';
import { ComponentGraphVisView } from './ComponentGraphVisView';

const GRAPH_EXPLORER_MODULE_HELP =
  'Elige un proyecto o repositorio indexado y carga el grafo Falkor tal cual quedó tras el sync: nodos (File, Component, Function, NestService, …) y aristas reales (IMPORTS, CONTAINS, CALLS, RENDERS, …). Sin capa C4. Opcional: elige un componente para ver un subgrafo de dependencias.';

const panelClass = cn(
  'rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm',
  'transition-shadow duration-[var(--transition-base)] hover:shadow-md',
);

const selectTriggerClass = cn(
  'h-11 w-full min-w-0 justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 shadow-sm',
  'text-left text-sm font-normal text-[var(--foreground)] hover:bg-[var(--card)]',
  'focus-visible:ring-1 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-0',
);

/** Fusiona conteos de varias respuestas graph-summary (multi-repo). */
function mergeSummaryCounts(summaries: Array<{ counts?: Record<string, number> }>): Record<string, number> | null {
  const acc: Record<string, number> = {};
  for (const s of summaries) {
    if (!s.counts) continue;
    for (const [k, v] of Object.entries(s.counts)) {
      if (typeof v === 'number' && Number.isFinite(v)) acc[k] = (acc[k] ?? 0) + v;
    }
  }
  return Object.keys(acc).length > 0 ? acc : null;
}

const GRAPH_SUMMARY_TRAFFIC_KEYS = ['Component', 'File', 'Function', 'Route'] as const;

/** Semáforo sobre la muestra del índice (mismos datos que el desplegable de componentes). */
function GraphSummaryTraffic({ counts }: { counts: Record<string, number> }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_35%,var(--card))] px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4',
      )}
    >
      <span className="shrink-0 text-xs font-semibold text-[var(--foreground)]">Índice (graph-summary)</span>
      <div className="flex flex-wrap gap-2">
        {GRAPH_SUMMARY_TRAFFIC_KEYS.map((key) => {
          const n = counts[key] ?? 0;
          const ok = n > 0;
          return (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs shadow-sm"
              title={ok ? `${n} nodos ${key} en la muestra` : `Sin nodos ${key} en la muestra`}
            >
              <span
                className={cn(
                  'size-2.5 shrink-0 rounded-full',
                  ok ? 'bg-emerald-500 shadow-[0_0_0_1px_rgba(0,0,0,0.08)]' : 'bg-[var(--muted)]',
                )}
                aria-hidden
              />
              <span className="text-[var(--foreground-muted)]">{key}</span>
              <span className="font-mono tabular-nums text-[var(--foreground)]">{n}</span>
            </span>
          );
        })}
      </div>
      <p className="m-0 w-full text-[10px] leading-snug text-[var(--foreground-muted)] sm:order-last sm:basis-full">
        Verde = hay nodos de ese tipo en el índice. Gris = cero en la muestra (revisa ingest o el alcance repo/proyecto).
      </p>
    </div>
  );
}

export function ComponentGraphExplorer() {
  const [search, setSearch] = useSearchParams();
  const [scopeKey, setScopeKey] = useState<string>(() => search.get('scope') ?? '');
  const [graphProjectId, setGraphProjectId] = useState(() => search.get('projectId') ?? '');
  const [name, setName] = useState(() => search.get('name') ?? '');
  const [depth, setDepth] = useState(() => search.get('depth') ?? '2');

  const [scopeOptions, setScopeOptions] = useState<ScopeOption[]>([]);
  const [scopesLoading, setScopesLoading] = useState(true);
  const [scopesErr, setScopesErr] = useState<string | null>(null);

  const [summaryCounts, setSummaryCounts] = useState<Record<string, number> | null>(null);
  const [componentNames, setComponentNames] = useState<string[]>([]);
  const [componentsLoading, setComponentsLoading] = useState(false);
  const [componentsErr, setComponentsErr] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [meta, setMeta] = useState<{ componentName: string; depth: number } | null>(null);
  /** Incrementa en cada carga exitosa para forzar remount del grafo (vis-network). */
  const [graphNonce, setGraphNonce] = useState(0);
  const [expanding, setExpanding] = useState(false);
  const [expandErr, setExpandErr] = useState<string | null>(null);
  /** API: sin depends salientes pero chat sí ve RENDERS — sugerir resync / misma causa raíz. */
  const [graphHints, setGraphHints] = useState<{ suggestResync?: boolean; messageEs?: string } | null>(null);
  const [indexedMode, setIndexedMode] = useState(true);
  const [indexedTruncated, setIndexedTruncated] = useState(false);
  const [indexedLimit, setIndexedLimit] = useState('500');
  /** Evita refetch del mismo componente al expandir (se resetea al cargar un grafo nuevo). */
  const expandedNamesRef = useRef<Set<string>>(new Set());

  /** Nombre en URL para hidratar el select cuando carguen los componentes del alcance. */
  const urlComponentRef = useRef<string | null>(search.get('name'));

  const selectedScope = useMemo(
    () => scopeOptions.find((o) => o.key === scopeKey) ?? null,
    [scopeOptions, scopeKey],
  );

  const rootFocalName = meta?.componentName ?? name.trim();
  const graphKey = useMemo(() => {
    if (nodes.length === 0) return '';
    return `${rootFocalName}|${graphNonce}|${nodes.length}|${edges.length}|${meta?.depth ?? ''}`;
  }, [rootFocalName, graphNonce, nodes.length, edges.length, meta?.depth]);

  const expandNode = useCallback(
    async (componentName: string) => {
      const pid = graphProjectId.trim();
      if (!pid) return;
      if (expandedNamesRef.current.has(componentName)) return;
      setExpandErr(null);
      setExpanding(true);
      try {
        const data = await api.getComponentGraph(componentName, {
          depth: 1,
          projectId: pid,
        });
        setNodes((prev) => mergeGraphNodes(prev, data.nodes ?? []));
        setEdges((prev) => mergeGraphEdges(prev, data.edges ?? []));
        expandedNamesRef.current.add(componentName);
        setGraphNonce((x) => x + 1);
      } catch (e) {
        setExpandErr(e instanceof Error ? e.message : String(e));
      } finally {
        setExpanding(false);
      }
    },
    [graphProjectId],
  );

  useEffect(() => {
    let cancel = false;
    (async () => {
      setScopesLoading(true);
      setScopesErr(null);
      try {
        const [projects, repos] = await Promise.all([api.getProjects(), api.getRepositories()]);
        if (cancel) return;
        const opts = buildScopeOptions(projects, repos);
        setScopeOptions(opts);

        const urlPid = search.get('projectId') ?? '';
        const urlScope = search.get('scope') ?? '';
        if (urlScope && opts.some((o) => o.key === urlScope)) {
          setScopeKey(urlScope);
        } else if (urlPid) {
          const hit =
            opts.find((o) => o.graphProjectId === urlPid) ??
            opts.find((o) => o.repoIdsForSummary.includes(urlPid));
          if (hit) setScopeKey(hit.key);
          else {
            setGraphProjectId(urlPid);
            setScopeKey('');
          }
        }
      } catch (e) {
        if (!cancel) setScopesErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancel) setScopesLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedScope) {
      setComponentNames([]);
      setSummaryCounts(null);
      setComponentsErr(null);
      return;
    }
    setGraphProjectId(selectedScope.graphProjectId);
    let cancel = false;
    (async () => {
      setComponentsLoading(true);
      setComponentsErr(null);
      try {
        /** Proyecto agregado: un graph-summary ya trae todo el shard; por repo: ?repoScoped=1. */
        let summaries: Awaited<ReturnType<typeof api.getGraphSummary>>[];
        if (selectedScope.repoScoped && selectedScope.repoIdsForSummary[0]) {
          summaries = [
            await api.getGraphSummary(selectedScope.repoIdsForSummary[0], true, true),
          ];
        } else if (selectedScope.repoIdsForSummary[0]) {
          summaries = [await api.getGraphSummary(selectedScope.repoIdsForSummary[0], true, false)];
        } else {
          summaries = [];
        }
        if (cancel) return;
        const merged = new Set<string>();
        setSummaryCounts(mergeSummaryCounts(summaries));
        for (const s of summaries) {
          for (const n of extractComponentNames(s.samples)) merged.add(n);
        }
        const list = [...merged].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        setComponentNames(list);
        const want = urlComponentRef.current;
        if (want && list.includes(want)) {
          setName(want);
          urlComponentRef.current = null;
          setErr(null);
        }
      } catch (e) {
        if (!cancel) {
          setComponentsErr(e instanceof Error ? e.message : String(e));
          setComponentNames([]);
          setSummaryCounts(null);
        }
      } finally {
        if (!cancel) setComponentsLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [selectedScope?.key]);

  const load = useCallback(async () => {
    const n = name.trim();
    const pid = graphProjectId.trim();
    if (!pid) {
      setErr('Elige un proyecto o repositorio indexado.');
      return;
    }
    setErr(null);
    setLoading(true);
    setGraphHints(null);
    setIndexedTruncated(false);
    try {
      if (n && n !== '__all__') {
        const d = Math.min(10, Math.max(1, parseInt(depth, 10) || 2));
        const data = await api.getComponentGraph(n, {
          depth: d,
          projectId: pid,
        });
        setNodes(data.nodes ?? []);
        setEdges(data.edges ?? []);
        setGraphHints(data.graphHints ?? null);
        setMeta({ componentName: data.componentName, depth: data.depth });
        setIndexedMode(false);
        expandedNamesRef.current.clear();
        setGraphNonce((x) => x + 1);
        setSearch((prev) => {
          const p = new URLSearchParams(prev);
          p.set('name', n);
          p.set('projectId', pid);
          p.set('depth', String(d));
          if (scopeKey) p.set('scope', scopeKey);
          else p.delete('scope');
          return p;
        });
        return;
      }

      const limit = Math.min(2000, Math.max(50, parseInt(indexedLimit, 10) || 500));
      const repoId =
        selectedScope?.repoScoped && selectedScope.repoIdsForSummary[0]
          ? selectedScope.repoIdsForSummary[0]
          : undefined;
      const data = await api.getIndexedGraphSnapshot({
        projectId: pid,
        repoId,
        limit,
      });
      setNodes(data.nodes ?? []);
      setEdges(data.edges ?? []);
      setMeta(null);
      setIndexedMode(true);
      setIndexedTruncated(Boolean(data.truncated));
      expandedNamesRef.current.clear();
      setGraphNonce((x) => x + 1);
      setSearch((prev) => {
        const p = new URLSearchParams(prev);
        p.delete('name');
        p.delete('depth');
        p.set('projectId', pid);
        if (scopeKey) p.set('scope', scopeKey);
        else p.delete('scope');
        return p;
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setNodes([]);
      setEdges([]);
      setGraphHints(null);
      setMeta(null);
      setIndexedTruncated(false);
    } finally {
      setLoading(false);
    }
  }, [name, graphProjectId, depth, indexedLimit, scopeKey, selectedScope, setSearch]);

  const projectOpts = scopeOptions.filter((o) => o.group === 'project');
  const projectRepoOpts = scopeOptions.filter((o) => o.group === 'project_repo');
  const standaloneOpts = scopeOptions.filter((o) => o.group === 'standalone');

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-4xl font-semibold tracking-tight text-[var(--foreground)]">Explorador de grafo</h1>
            <HoverCard openDelay={200} closeDelay={100}>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--foreground-muted)] transition-colors',
                    'hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)] hover:text-[var(--primary)]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]',
                  )}
                  aria-label="Información: explorador de grafo"
                >
                  <Info className="size-5" strokeWidth={1.75} aria-hidden />
                </button>
              </HoverCardTrigger>
              <HoverCardContent
                side="bottom"
                align="start"
                className="w-[min(22rem,calc(100vw-2rem))] max-w-md border-[var(--border)] bg-[var(--card)] p-4 text-sm leading-relaxed text-[var(--foreground)] shadow-md"
              >
                <p className="m-0 text-[var(--foreground-muted)]">{GRAPH_EXPLORER_MODULE_HELP}</p>
              </HoverCardContent>
            </HoverCard>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--foreground-muted)]">
            Visualiza relaciones reales del índice Falkor (sync/resync). Opcionalmente enfoca un componente React/Nest.
          </p>
        </div>
      </div>

      {scopesErr ? (
        <Alert variant="destructive">
          <AlertTitle>No se pudieron cargar los alcances</AlertTitle>
          <AlertDescription>{scopesErr}</AlertDescription>
        </Alert>
      ) : null}

      {scopesLoading ? (
        <section className={panelClass}>
          <div className="space-y-2">
            <Skeleton className="h-7 w-56 rounded-lg" />
            <Skeleton className="h-4 w-full max-w-2xl rounded-lg" />
          </div>
          <div className="mt-6 flex flex-wrap items-end gap-4">
            <Skeleton className="h-11 w-full min-w-[200px] max-w-md flex-1 rounded-xl" />
            <Skeleton className="h-11 w-full min-w-[200px] max-w-md flex-1 rounded-xl" />
            <Skeleton className="h-11 w-20 rounded-xl" />
            <Skeleton className="h-11 w-36 rounded-xl" />
          </div>
          <Skeleton className="mt-8 h-[min(24rem,50vh)] w-full rounded-2xl" />
        </section>
      ) : (
        <>
          {scopeOptions.length === 0 && !scopesErr ? (
            <section className={panelClass}>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Alcance</h2>
                <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                  Hace falta al menos un proyecto o un repositorio indexado para consultar el grafo.
                </p>
              </div>
              <div className="mt-8">
                <div
                  className={cn(
                    'flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)]',
                    'bg-[color-mix(in_oklch,var(--muted)_45%,transparent)] px-6 py-14 text-center',
                  )}
                >
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[var(--primary)]">
                    <Share2 className="size-6" strokeWidth={1.75} aria-hidden />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-[var(--foreground)]">Sin proyectos ni repositorios</p>
                  <p className="mt-1 max-w-md text-xs leading-relaxed text-[var(--foreground-muted)]">
                    Crea un proyecto y vincula repos con ingest, o registra un repositorio aislado. Tras indexar, el
                    desplegable de alcance se llenará solo.
                  </p>
                  <div className="mt-6 flex w-full max-w-sm flex-col gap-2 sm:flex-row sm:justify-center">
                    <Button className="h-11 w-full rounded-xl sm:w-auto" asChild>
                      <Link to="/projects/new">Crear proyecto</Link>
                    </Button>
                    <Button variant="outline" className="h-11 w-full rounded-xl border-[var(--border)] sm:w-auto" asChild>
                      <Link to="/repos">Ir a repositorios</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {scopeOptions.length > 0 ? (
            <section className={panelClass}>
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="min-w-0 flex-1 basis-[min(100%,20rem)] space-y-2">
                  <Label className="text-xs font-medium text-[var(--foreground-muted)]">Proyecto o repositorio</Label>
                  <Select
                    value={scopeKey || undefined}
                    onValueChange={(v) => {
                      setScopeKey(v);
                      setName('');
                      setNodes([]);
                      setEdges([]);
                      setMeta(null);
                      setGraphHints(null);
                      setErr(null);
                    }}
                    disabled={scopesLoading || scopeOptions.length === 0}
                  >
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue placeholder="Selecciona alcance" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectOpts.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Proyectos</SelectLabel>
                          {projectOpts.map((o) => (
                            <SelectItem key={o.key} value={o.key}>
                              <span className="font-medium">{o.label}</span>
                              <span className="block max-w-[280px] truncate text-xs text-[var(--foreground-muted)]">
                                {o.detail}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {projectRepoOpts.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Repos por proyecto</SelectLabel>
                          {projectRepoOpts.map((o) => (
                            <SelectItem key={o.key} value={o.key}>
                              <span className="font-medium">{o.label}</span>
                              <span className="block max-w-[280px] truncate text-xs text-[var(--foreground-muted)]">
                                {o.detail}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {standaloneOpts.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Repositorios aislados</SelectLabel>
                          {standaloneOpts.map((o) => (
                            <SelectItem key={o.key} value={o.key}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-0 flex-1 basis-[min(100%,18rem)] space-y-2">
                  <Label htmlFor="comp-select" className="text-xs font-medium text-[var(--foreground-muted)]">
                    Componente (opcional)
                  </Label>
                  <Select
                    value={name.trim() && name !== '__all__' ? name.trim() : '__all__'}
                    onValueChange={(v) => {
                      setName(v === '__all__' ? '' : v);
                      setErr(null);
                      setNodes([]);
                      setEdges([]);
                      setMeta(null);
                      setGraphHints(null);
                      setIndexedTruncated(false);
                    }}
                    disabled={!selectedScope || componentsLoading}
                  >
                    <SelectTrigger id="comp-select" className={selectTriggerClass}>
                      <SelectValue
                        placeholder={
                          !selectedScope
                            ? 'Primero el alcance'
                            : componentsLoading
                              ? 'Cargando índice…'
                              : componentNames.length === 0
                                ? 'Todo el índice (sin foco)'
                                : 'Todo el índice (sin foco)'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="max-h-[280px]">
                      <SelectItem value="__all__">Todo el índice (relaciones crudas)</SelectItem>
                      {componentNames.map((cn) => (
                        <SelectItem key={cn} value={cn}>
                          Enfocar: {cn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[5.5rem]">
                  <Label htmlFor="indexed-limit" className="text-xs font-medium text-[var(--foreground-muted)]">
                    {name.trim() && name !== '__all__' ? 'Profundidad' : 'Límite aristas'}
                  </Label>
                  {name.trim() && name !== '__all__' ? (
                    <Input
                      id="depth"
                      type="number"
                      min={1}
                      max={10}
                      value={depth}
                      onChange={(e) => {
                        setDepth(e.target.value);
                        setErr(null);
                      }}
                      className="h-11 w-full rounded-xl border-[var(--border)] bg-[var(--card)] sm:w-20"
                    />
                  ) : (
                    <Select value={indexedLimit} onValueChange={setIndexedLimit}>
                      <SelectTrigger id="indexed-limit" className={cn(selectTriggerClass, 'sm:w-28')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="300">300</SelectItem>
                        <SelectItem value="500">500</SelectItem>
                        <SelectItem value="1000">1000</SelectItem>
                        <SelectItem value="2000">2000</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:shrink-0">
                  <Label className="pointer-events-none select-none opacity-0" aria-hidden="true">
                    Profundidad
                  </Label>
                  <Button
                    type="button"
                    className="h-11 w-full shrink-0 rounded-xl sm:w-auto sm:min-w-[10.5rem]"
                    onClick={() => void load()}
                    disabled={loading || !selectedScope}
                  >
                    {loading ? 'Cargando…' : name.trim() && name !== '__all__' ? 'Cargar enfoque' : 'Cargar grafo indexado'}
                  </Button>
                </div>
              </div>

              {selectedScope ? (
                <p
                  className="mt-3 truncate rounded-lg border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_14%,var(--card))] px-3 py-2 font-mono text-xs text-[var(--foreground-muted)]"
                  title={selectedScope.graphProjectId}
                >
                  <span className="font-sans font-medium text-[var(--foreground)]">projectId</span>{' '}
                  {selectedScope.graphProjectId}
                </p>
              ) : null}
              {graphProjectId && !selectedScope ? (
                <p className="mt-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-50">
                  El projectId de la URL no coincide con ningún proyecto o repo aislado en esta cuenta. Revisa el UUID
                  o sincroniza el índice.
                </p>
              ) : null}
            </section>
          ) : null}

          {componentsErr ? (
            <Alert variant="destructive">
              <AlertTitle>Componentes</AlertTitle>
              <AlertDescription>{componentsErr}</AlertDescription>
            </Alert>
          ) : null}

          {err ? (
            <Alert variant="destructive">
              <AlertTitle>Grafo</AlertTitle>
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          ) : null}

          {indexedTruncated ? (
            <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-50">
              <AlertTitle>Vista parcial</AlertTitle>
              <AlertDescription>
                Se alcanzó el límite de aristas. Sube el límite, acota a un solo repo, o usa el panel Cypher debug abajo.
              </AlertDescription>
            </Alert>
          ) : null}

          {graphHints?.suggestResync && graphHints.messageEs ? (
            <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-50">
              <AlertTitle>Aristas ausentes</AlertTitle>
              <AlertDescription>
                <span className="font-semibold">Sugerencia: </span>
                {graphHints.messageEs}
              </AlertDescription>
            </Alert>
          ) : null}

          {selectedScope && summaryCounts ? <GraphSummaryTraffic counts={summaryCounts} /> : null}

          {expandErr ? (
            <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-50">
              <AlertTitle>Expansión</AlertTitle>
              <AlertDescription>{expandErr}</AlertDescription>
            </Alert>
          ) : null}

          <ComponentGraphVisView
            graphNodes={nodes}
            graphEdges={edges}
            rootFocalName={rootFocalName}
            graphKey={graphKey}
            projectId={graphProjectId}
            expanding={expanding}
            indexedMode={indexedMode}
            onExpandNode={expandNode}
          />

          <ComponentGraphDebugPanel
            graphProjectId={graphProjectId}
            prefillComponentName={meta?.componentName ?? name.trim()}
          />
        </>
      )}
    </div>
  );
}
