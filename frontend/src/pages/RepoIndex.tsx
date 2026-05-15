/**
 * @fileoverview Índice FalkorDB: izquierda = todos los ítems (File, Component, Function, Hook…), derecha = código al hacer click.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api';
import type { Repository } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { panelIntroClass, sectionHeaderClass, sectionShellClass } from './RepoDetail/layoutClasses';

/** Etiquetas de nodos en el grafo FalkorDB. */
type IndexLabel =
  | 'File'
  | 'Component'
  | 'Function'
  | 'Model'
  | 'Route'
  | 'Hook'
  | 'DomainConcept'
  | 'Prop'
  | 'NestController'
  | 'NestService'
  | 'NestModule';

/** Fila de muestra del índice (path, name, componentName, category, endpointCalls). */
interface IndexRow {
  path?: string;
  name?: string;
  componentName?: string;
  category?: string;
  endpointCalls?: Array<{ method: string; line: number }> | string;
}

const LABEL_ORDER: IndexLabel[] = [
  'File',
  'Component',
  'Function',
  'Model',
  'Route',
  'Hook',
  'DomainConcept',
  'Prop',
  'NestController',
  'NestService',
  'NestModule',
];

/** Etiqueta amigable para UI (dominios de problema) */
const LABEL_DISPLAY: Partial<Record<IndexLabel, string>> = {
  DomainConcept: 'Dominio',
};

const indexPageClass =
  'mx-auto flex h-[calc(100vh-8rem)] w-full max-w-[min(1400px,calc(100vw-2rem))] flex-col gap-4 sm:gap-5';

const navBtnClass =
  'h-10 gap-2 rounded-xl border-[var(--border)] bg-[var(--card)] px-3 text-[var(--foreground)] touch-manipulation';

const tabListClass = cn(
  'inline-flex w-full flex-wrap gap-1 rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_22%,var(--card))] p-1',
);

const tabPillActiveClass =
  'bg-[var(--card)] text-[var(--foreground)] shadow-sm ring-1 ring-[var(--border)]/80';
const tabPillInactiveClass =
  'text-[var(--foreground-muted)] hover:bg-[var(--card)]/50 hover:text-[var(--foreground)]';

const inputClass = cn(
  'h-11 w-full rounded-xl border-[var(--border)] bg-[var(--card)] text-sm',
  'placeholder:text-[var(--foreground-muted)]',
  'focus-visible:ring-2 focus-visible:ring-[var(--foreground)]/18 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]',
);

const codePreClass = cn(
  'rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_16%,var(--card))] p-4',
  'font-mono text-xs leading-relaxed text-[var(--foreground)]',
  'whitespace-pre-wrap break-words overflow-x-auto',
);

/**
 * Página de índice del grafo: panel izquierdo con pestañas por tipo (File, Component, Function, etc.) y búsqueda;
 * panel derecho muestra el contenido del archivo al hacer click en un ítem con path.
 */
export function RepoIndex() {
  const { id } = useParams<{ id: string }>();
  const [repo, setRepo] = useState<Repository | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [samples, setSamples] = useState<Record<string, IndexRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [activeLabel, setActiveLabel] = useState<IndexLabel>('File');
  const [searchByLabel, setSearchByLabel] = useState<Partial<Record<IndexLabel, string>>>({});

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api
      .getRepository(id)
      .then(setRepo)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const loadFullIndex = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api
      .getGraphSummary(id, true, true)
      .then((res) => {
        setCounts(res.counts);
        setSamples(res.samples as Record<string, IndexRow[]>);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (id && repo) loadFullIndex();
  }, [id, repo?.id, loadFullIndex]);

  const loadFile = useCallback(
    (path: string) => {
      if (!id || !path) return;
      setSelectedPath(path);
      setLoadingFile(true);
      setFileContent(null);
      api
        .getFileContent(id, path)
        .then((r) => setFileContent(r.content))
        .catch(() => setFileContent(null))
        .finally(() => setLoadingFile(false));
    },
    [id],
  );

  const searchTerm = (searchByLabel[activeLabel] ?? '').trim().toLowerCase();
  const filteredRows = (samples[activeLabel] ?? []).filter((row) => {
    if (!searchTerm) return true;
    const path = (row.path ?? '').toLowerCase();
    const name = ((row.name ?? row.componentName) ?? '').toLowerCase();
    const category = (row.category ?? '').toLowerCase();
    return path.includes(searchTerm) || name.includes(searchTerm) || category.includes(searchTerm);
  });

  /** Parsea endpointCalls (puede venir como string JSON desde el grafo). */
  function parseEndpointCalls(row: IndexRow): Array<{ method: string; line: number }> | undefined {
    if (typeof row.endpointCalls !== 'string') return row.endpointCalls as Array<{ method: string; line: number }> | undefined;
    try {
      return JSON.parse(row.endpointCalls) as Array<{ method: string; line: number }>;
    } catch {
      return undefined;
    }
  }

  /** Renderiza una fila del índice (path/name, click para cargar archivo si aplica). */
  function renderRow(label: IndexLabel, row: IndexRow, i: number) {
    const path = row.path;
    const name = row.name ?? row.componentName;
    const clickableLabels: IndexLabel[] = [
      'File',
      'Component',
      'Function',
      'Model',
      'Hook',
      'DomainConcept',
      'NestController',
      'NestService',
      'NestModule',
    ];
    const isClickable = !!path && clickableLabels.includes(label);
    const endpointCalls = parseEndpointCalls(row);
    const endpointBadge =
      label === 'Function' && endpointCalls?.length ? ` (${endpointCalls.map((e) => e.method).join(', ')})` : '';
    const categorySuffix = label === 'DomainConcept' && row.category ? ` · ${row.category}` : '';
    const display =
      label === 'File'
        ? path
        : name
          ? path
            ? `${path} · ${name}${categorySuffix}`
            : `${name}${categorySuffix}`
          : (path ?? JSON.stringify(row));

    return (
      <li
        key={i}
        className={cn(
          'min-w-max cursor-pointer whitespace-nowrap rounded-lg px-2 py-1.5 text-xs transition-colors',
          'hover:bg-[color-mix(in_oklch,var(--muted)_45%,var(--card))]',
          selectedPath === path ? 'bg-[color-mix(in_oklch,var(--muted)_55%,var(--card))]' : '',
          isClickable ? 'text-[var(--foreground)]' : 'cursor-default text-[var(--foreground-muted)]',
        )}
        onClick={() => isClickable && path && loadFile(path)}
        title={endpointBadge ? `${path ?? String(display)}${endpointBadge}` : path ?? String(display)}
        role={isClickable ? 'button' : undefined}
      >
        {display}
      </li>
    );
  }

  /** Contenido del panel izquierdo: loading, lista filtrada, o mensaje vacío. */
  function renderListContent() {
    if (loading) {
      return <p className="text-sm text-[var(--foreground-muted)]">Cargando índice…</p>;
    }
    if (filteredRows.length) {
      return (
        <ul className="min-w-full space-y-0.5">
          {filteredRows.map((row, i) => renderRow(activeLabel, row, i))}
        </ul>
      );
    }
    if (samples[activeLabel]?.length) {
      return (
        <p className="text-sm text-[var(--foreground-muted)]">
          No hay resultados para &quot;{searchTerm}&quot;. Prueba otro término.
        </p>
      );
    }
    return (
      <p className="text-sm text-[var(--foreground-muted)]">
        {counts[activeLabel] === 0 ? 'No hay datos.' : 'Cargando…'}
      </p>
    );
  }

  /** Contenido del panel derecho: loading, pre con código, o mensaje. */
  function renderCodeContent() {
    if (loadingFile) {
      return <p className="text-sm text-[var(--foreground-muted)]">Cargando código…</p>;
    }
    if (fileContent != null) {
      return <pre className={codePreClass}>{fileContent}</pre>;
    }
    if (selectedPath) {
      return <p className="text-sm text-[var(--foreground-muted)]">No se pudo cargar el archivo.</p>;
    }
    return (
      <p className="text-sm text-[var(--foreground-muted)]">
        Haz click en un archivo, componente o función de la lista.
      </p>
    );
  }

  if (!id) return null;
  if (error && !repo) {
    return (
      <div className={cn(indexPageClass, 'h-auto pb-10')}>
        <Button type="button" variant="outline" size="sm" className={navBtnClass} asChild>
          <Link to="/repos">
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            Repos
          </Link>
        </Button>
        <div className={panelIntroClass}>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Índice</h2>
          <p className="mt-2 text-sm text-[var(--foreground-muted)]">No se pudo cargar el repositorio.</p>
        </div>
        <Alert variant="destructive" className="rounded-2xl">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }
  if (!repo) {
    return (
      <div className={cn(indexPageClass, 'h-auto pb-10')}>
        <Button type="button" variant="outline" size="sm" className={navBtnClass} asChild>
          <Link to="/repos">
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            Repos
          </Link>
        </Button>
        <section className={sectionShellClass}>
          <div className={sectionHeaderClass}>
            <Skeleton className="h-7 w-64 max-w-full rounded-lg" />
          </div>
          <div className="space-y-3 p-5 sm:p-6">
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </section>
      </div>
    );
  }

  const visibleLabels = LABEL_ORDER.filter((l) => (counts[l] ?? 0) > 0);

  return (
    <div className={indexPageClass}>
      <header className="flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className={navBtnClass} asChild>
            <Link to="/repos">
              <ArrowLeft className="size-4 shrink-0" aria-hidden />
              Repos
            </Link>
          </Button>
          <Button type="button" variant="outline" size="sm" className={navBtnClass} asChild>
            <Link to={`/repos/${id}`}>Detalle</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" className={navBtnClass} asChild>
            <Link to={`/repos/${id}/chat`}>Chat</Link>
          </Button>
        </div>
        <div className={cn(panelIntroClass, 'min-w-0 flex-1 py-3 sm:max-w-[min(100%,40rem)] sm:flex-none sm:px-5 sm:py-3')}>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]">Índice FalkorDB</p>
          <p className="mt-1 break-all font-mono text-sm font-semibold text-[var(--foreground)] sm:break-words sm:text-base">
            {repo.projectKey}/{repo.repoSlug}
          </p>
        </div>
      </header>

      {error ? (
        <Alert variant="destructive" className="shrink-0 rounded-xl">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-5">
        <aside className="flex min-h-0 w-full flex-col lg:w-[min(400px,38%)] lg:shrink-0">
          <nav className="mb-3 shrink-0" aria-label="Tipo de nodo en el índice">
            <div className={tabListClass}>
              {visibleLabels.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setActiveLabel(label)}
                  className={cn(
                    'rounded-xl px-3 py-2 text-xs font-medium transition-colors',
                    activeLabel === label ? tabPillActiveClass : tabPillInactiveClass,
                  )}
                >
                  {LABEL_DISPLAY[label] ?? label} ({counts[label] ?? 0})
                </button>
              ))}
            </div>
          </nav>

          <section className={cn(sectionShellClass, 'flex min-h-0 flex-1 flex-col overflow-hidden')}>
            <div className={sectionHeaderClass}>
              <h2 className="text-base font-semibold text-[var(--foreground)]">
                {LABEL_DISPLAY[activeLabel] ?? activeLabel}{' '}
                <span className="font-normal text-[var(--foreground-muted)]">({counts[activeLabel] ?? 0})</span>
              </h2>
              <div className="mt-3 space-y-2">
                <Input
                  placeholder={`Buscar en ${LABEL_DISPLAY[activeLabel] ?? activeLabel}…`}
                  value={searchByLabel[activeLabel] ?? ''}
                  onChange={(e) =>
                    setSearchByLabel((prev) => ({ ...prev, [activeLabel]: e.target.value }))
                  }
                  className={inputClass}
                  aria-label={`Filtrar lista de ${LABEL_DISPLAY[activeLabel] ?? activeLabel}`}
                />
                <p className="text-xs leading-relaxed text-[var(--foreground-muted)]">
                  Click en un ítem con path para ver el código
                </p>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-4 py-3 sm:px-5">{renderListContent()}</div>
          </section>
        </aside>

        <section className={cn(sectionShellClass, 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden')}>
          <div className={sectionHeaderClass}>
            <h2 className="truncate text-base font-semibold text-[var(--foreground)]">
              {selectedPath ?? 'Selecciona un archivo'}
            </h2>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-[color-mix(in_oklch,var(--muted)_10%,var(--card))] p-4 sm:p-5">
            {renderCodeContent()}
          </div>
        </section>
      </div>
    </div>
  );
}
