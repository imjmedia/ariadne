/**
 * Panel colapsable: consulta Cypher contra Falkor vía API Nest (misma conexión que getComponentGraph).
 */
import { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

function escapeCypherString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const inputMonoClass = cn(
  'h-11 rounded-xl border-[var(--border)] bg-[var(--card)] font-mono text-xs shadow-sm',
  'placeholder:text-[var(--foreground-muted)] focus-visible:ring-1 focus-visible:ring-[var(--ring)]',
);

const textareaMonoClass = cn(
  'min-h-[11rem] w-full resize-y rounded-xl border-[var(--border)] bg-[var(--card)] px-3 py-2.5 font-mono text-xs leading-relaxed',
  'text-[var(--foreground)] shadow-sm placeholder:text-[var(--foreground-muted)]',
  'focus-visible:ring-1 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-0',
);

type Props = {
  graphProjectId: string;
  prefillComponentName?: string;
  /** Ocultar en vista C4. */
  hidden?: boolean;
};

export function ComponentGraphDebugPanel({ graphProjectId, prefillComponentName, hidden }: Props) {
  const defaultQuery = useMemo(() => {
    const pid = graphProjectId.trim();
    if (!pid) {
      return 'MATCH (n) RETURN count(n) AS c LIMIT 1';
    }
    const cn = prefillComponentName?.trim();
    if (cn) {
      return [
        `MATCH (c:Component { name: '${escapeCypherString(cn)}', projectId: '${escapeCypherString(pid)}' })`,
        `RETURN c`,
        `LIMIT 25`,
      ].join('\n');
    }
    return [
      `MATCH (c:Component { projectId: '${escapeCypherString(pid)}' })`,
      `RETURN c.name AS name, labels(c) AS labels`,
      `LIMIT 50`,
    ].join('\n');
  }, [graphProjectId, prefillComponentName]);

  const [query, setQuery] = useState(defaultQuery);
  useEffect(() => {
    setQuery(defaultQuery);
  }, [defaultQuery]);

  const [graphNameOverride, setGraphNameOverride] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resultJson, setResultJson] = useState<string | null>(null);

  const run = () => {
    setErr(null);
    setResultJson(null);
    setLoading(true);
    void (async () => {
      try {
        const r = await api.postFalkorDebugQuery({
          query,
          projectId: graphProjectId.trim() || undefined,
          graphName: graphNameOverride.trim() || undefined,
        });
        setResultJson(JSON.stringify(r, null, 2));
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  };

  if (hidden) return null;

  return (
    <details
      className={cn(
        'group overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-sm',
        'transition-shadow duration-[var(--transition-base)] hover:shadow-md open:shadow-md',
      )}
    >
      <summary
        className={cn(
          'flex min-h-11 w-full cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm tracking-tight select-none',
          'border-b border-transparent bg-[color-mix(in_oklch,var(--muted)_28%,var(--card))]',
          'hover:bg-[color-mix(in_oklch,var(--muted)_38%,var(--card))]',
          'group-open:border-[var(--border)]',
          '[&::-webkit-details-marker]:hidden',
        )}
      >
        <ChevronRight
          className="size-4 shrink-0 text-[var(--foreground-muted)] transition-transform duration-200 group-open:rotate-90"
          aria-hidden
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-x-3 sm:gap-y-0">
          <span className="shrink-0 font-semibold text-[var(--foreground)]">Falkor (Cypher vía API)</span>
          <span className="text-xs font-normal leading-snug text-[var(--foreground-muted)] sm:truncate">
            misma conexión que Nest — activar FALKOR_DEBUG_CYPHER=1
          </span>
        </div>
      </summary>
      <div className="space-y-5 bg-[var(--card)] p-5">
        <p className="m-0 text-xs leading-relaxed text-[var(--foreground-muted)]">
          No es el contenedor desde el navegador: el front llama a{' '}
          <span className="font-mono text-[11px] text-[var(--foreground)]">POST /api/graph/falkor-debug-query</span> y
          Nest ejecuta en Falkor con <span className="font-mono text-[11px] text-[var(--foreground)]">FalkorService</span>
          . Así validas que los datos coinciden con lo que devuelve{' '}
          <span className="font-mono text-[11px] text-[var(--foreground)]">getComponentGraph</span> sin exponer Redis.
        </p>
        <div className="space-y-2">
          <Label htmlFor="falkor-graph-name" className="text-xs font-medium text-[var(--foreground-muted)]">
            graphName (opcional, shard explícito)
          </Label>
          <Input
            id="falkor-graph-name"
            value={graphNameOverride}
            onChange={(e) => setGraphNameOverride(e.target.value)}
            placeholder="Vacío = grafo por projectId (routing habitual)"
            className={inputMonoClass}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="falkor-query" className="text-xs font-medium text-[var(--foreground-muted)]">
            Cypher (solo lectura)
          </Label>
          <Textarea id="falkor-query" value={query} onChange={(e) => setQuery(e.target.value)} spellCheck={false} className={textareaMonoClass} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="h-11 rounded-xl"
            onClick={run}
            disabled={loading || !query.trim()}
            aria-busy={loading}
          >
            {loading ? 'Ejecutando…' : 'Ejecutar'}
          </Button>
        </div>
        {err ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap text-xs">{err}</AlertDescription>
          </Alert>
        ) : null}
        {resultJson ? (
          <pre
            className={cn(
              'max-h-[min(480px,55vh)] overflow-auto rounded-xl border border-[var(--border)]',
              'bg-[color-mix(in_oklch,var(--muted)_40%,var(--card))] p-4 text-[11px] leading-relaxed text-[var(--foreground)]',
              'font-mono shadow-inner',
            )}
          >
            {resultJson}
          </pre>
        ) : null}
      </div>
    </details>
  );
}
