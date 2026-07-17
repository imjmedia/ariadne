import { Link } from 'react-router-dom';
import type { Repository } from '../../types';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { StatusBadge } from '@/components/StatusBadge';
import { cn } from '@/lib/utils';
import {
  monoIdFieldClass,
  monoIdFieldWarningClass,
  sectionHeaderClass,
  sectionShellClass,
} from './layoutClasses';

const STALE_SYNC_HOURS = 72;

function isRepoIndexStale(lastSyncAt: string | null | undefined): boolean {
  if (!lastSyncAt) return true;
  const ms = Date.now() - new Date(lastSyncAt).getTime();
  if (Number.isNaN(ms)) return true;
  return ms > STALE_SYNC_HOURS * 3600_000;
}

interface RepoDetailRepoCardProps {
  repo: Repository;
  id: string;
  syncing: boolean;
  deleting: boolean;
  syncFeedback: string | null;
  embedding: boolean;
  embedFeedback: string | null;
  onDelete: () => void;
  onSync: () => void;
  onResync: () => void;
  onEmbedIndex: () => void;
}

const actionButtonClass = 'h-11 shrink-0 rounded-xl';

function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text);
}

/** Main repository summary: metadata, MCP IDs, grouped actions (nav, sync, delete), feedback. */
export function RepoDetailRepoCard({
  repo,
  id,
  syncing,
  deleting,
  syncFeedback,
  embedding,
  embedFeedback,
  onDelete,
  onSync,
  onResync,
  onEmbedIndex,
}: RepoDetailRepoCardProps) {
  const effectiveProjectId = repo.projectIds?.[0] ?? repo.id;
  const idsCollide = effectiveProjectId === repo.id;

  return (
    <section className={sectionShellClass} aria-labelledby="repo-detail-title">
      <div className={sectionHeaderClass}>
        <h1
          id="repo-detail-title"
          className="text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl"
        >
          <span className="break-words">
            <span className="capitalize text-[var(--foreground-muted)]">{repo.provider}</span>
            <span className="text-[var(--foreground-subtle)]"> / </span>
            <span className="font-mono text-[var(--foreground)]">{repo.projectKey}</span>
            <span className="text-[var(--foreground-subtle)]"> / </span>
            <span className="font-mono text-[var(--foreground)]">{repo.repoSlug}</span>
          </span>
        </h1>
      </div>

      <div className="space-y-6 px-5 py-5 sm:px-6 sm:py-6">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]">Branch</dt>
            <dd className="mt-1 font-mono text-sm text-[var(--foreground)]">{repo.defaultBranch}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]">Estado</dt>
            <dd>
              <StatusBadge status={repo.status} />
            </dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]">
              Último sync
            </dt>
            <dd className="mt-1 font-mono text-sm text-[var(--foreground)]">
              {repo.lastSyncAt ? new Date(repo.lastSyncAt).toLocaleString() : '—'}
              {isRepoIndexStale(repo.lastSyncAt) && repo.status === 'ready' ? (
                <span className="ml-2 text-xs font-sans text-amber-600 dark:text-amber-400">
                  Índice desactualizado (&gt;72h) — resync antes de planear cambios
                </span>
              ) : null}
            </dd>
          </div>
          {repo.lastCommitSha ? (
            <div className="sm:col-span-2 lg:col-span-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]">
                Último commit
              </dt>
              <dd className="mt-1">
                <code className="inline-block rounded-lg border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_35%,var(--card))] px-2 py-1 font-mono text-xs text-[var(--foreground)]">
                  {repo.lastCommitSha.slice(0, 7)}
                </code>
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <div className="text-xs font-medium text-[var(--foreground-muted)]">Repository ID</div>
            <code
              role="button"
              tabIndex={0}
              onClick={() => copyToClipboard(repo.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') copyToClipboard(repo.id);
              }}
              title="Clic para copiar"
              className={cn(monoIdFieldClass, 'select-text')}
            >
              {repo.id}
            </code>
          </div>
          <div>
            <div className="text-xs font-medium text-[var(--foreground-muted)]">Project ID (MCP)</div>
            <code
              role="button"
              tabIndex={0}
              onClick={() => copyToClipboard(effectiveProjectId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') copyToClipboard(effectiveProjectId);
              }}
              title="Clic para copiar"
              className={cn(idsCollide ? monoIdFieldWarningClass : monoIdFieldClass, 'select-text')}
            >
              {effectiveProjectId}
            </code>
            {idsCollide ? (
              <p className="mt-1.5 text-xs leading-relaxed text-amber-800 dark:text-amber-200/90">
                Coincide con el ID del repositorio; confirma la asociación al proyecto MCP si aplica.
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-5 border-t border-[var(--border)] pt-6">
          <div>
            <p className="mb-2 text-xs font-medium text-[var(--foreground-muted)]">Accesos</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className={actionButtonClass} asChild>
                <Link to={`/repos/${id}/edit`}>Editar</Link>
              </Button>
              <Button variant="outline" className={actionButtonClass} asChild>
                <Link to={`/repos/${id}/chat`}>Chat</Link>
              </Button>
              <Button variant="outline" className={actionButtonClass} asChild>
                <Link to={`/repos/${id}/index`}>Índice</Link>
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-[var(--foreground-muted)]">Sincronización</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className={actionButtonClass}
                onClick={onSync}
                disabled={syncing}
                title="Clona/indexa en Falkor y, si no está desactivado en el servidor, ejecuta embed-index al final del mismo job (vectores)."
              >
                {syncing ? 'Encolando…' : 'Sync ahora'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className={actionButtonClass}
                onClick={onResync}
                disabled={syncing}
                title="Borra el slice Falkor del repo y vuelve a indexar; incluye embed-index al final del job salvo SYNC_SKIP_EMBED_INDEX / fallo de vector."
              >
                Re-sincronizar todo
              </Button>
              <Button
                type="button"
                variant="outline"
                className={actionButtonClass}
                onClick={onEmbedIndex}
                disabled={embedding || syncing}
                title="Solo re-vectorizar nodos ya indexados (p. ej. tras cambiar modelo de embedding o si el post-sync falló). Sync / resync ya encadenan esto cuando el ingest está bien configurado."
              >
                {embedding ? 'Embeddings…' : 'Solo vectores (reparar)'}
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-[var(--foreground-muted)]">Peligro</p>
            <Button
              type="button"
              variant="destructive"
              className={actionButtonClass}
              onClick={onDelete}
              disabled={deleting}
            >
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </div>
        </div>

        {syncFeedback ? (
          <Alert className="rounded-xl border-emerald-500/35 bg-emerald-500/10 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-50">
            <AlertTitle className="text-sm">Sync</AlertTitle>
            <AlertDescription>{syncFeedback}</AlertDescription>
          </Alert>
        ) : null}
        {embedFeedback ? (
          <Alert className="rounded-xl border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_22%,var(--card))]">
            <AlertTitle className="text-sm text-[var(--foreground)]">Embeddings</AlertTitle>
            <AlertDescription className="text-[var(--foreground-muted)]">{embedFeedback}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </section>
  );
}
