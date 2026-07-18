/**
 * @fileoverview Lista de repositorios: DataTable con ordenación y filtro, alta por modal alineado a otros módulos.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import type { ColumnDef } from "@tanstack/react-table"
import { GitBranch, Info } from "lucide-react"
import { api } from "@/api"
import type { Repository } from "@/types"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StatusBadge } from "@/components/StatusBadge"
import { DataTable } from "@/components/data-table/DataTable"
import { CreateRepoDialog, NEW_REPOSITORY_LABEL } from "@/components/repos/CreateRepoDialog"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { cn } from "@/lib/utils"
import { useActiveSyncJobStatuses } from "@/lib/useActiveSyncJobStatuses"

const REPOSITORIES_MODULE_HELP =
  "Repositorios sincronizados con FalkorSpecs: ingest, webhooks y jobs en segundo plano. Usa la búsqueda sobre la tabla para filtrar por provider, proyecto, slug o ID MCP; las cabeceras ordenan columnas."

const panelClass = cn(
  "rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm",
  "transition-shadow duration-[var(--transition-base)] hover:shadow-md",
)

export function RepoList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [repos, setRepos] = useState<Repository[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [resyncingId, setResyncingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createProjectId, setCreateProjectId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Repository | null>(null)
  const [resyncTarget, setResyncTarget] = useState<Repository | null>(null)
  const {
    displayStatus,
    refresh: refreshActiveJobs,
    setOptimistic,
    hasActiveJobs,
  } = useActiveSyncJobStatuses()

  const fetchRepos = useCallback(() => {
    setError(null)
    return api
      .getRepositories()
      .then(setRepos)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  useEffect(() => {
    setLoading(true)
    void fetchRepos().finally(() => setLoading(false))
  }, [fetchRepos])

  useEffect(() => {
    if (!hasActiveJobs) return
    const t = setInterval(() => {
      void fetchRepos()
    }, 2000)
    return () => clearInterval(t)
  }, [hasActiveJobs, fetchRepos])

  /** Deep link from project detail or legacy `/repos/new?projectId=` → `/repos?openCreate=1&projectId=`. */
  useEffect(() => {
    if (searchParams.get("openCreate") !== "1") return
    const pid = searchParams.get("projectId")
    setCreateProjectId(pid)
    setCreateOpen(true)
    navigate("/repos", { replace: true })
  }, [searchParams, navigate])

  const handleCreateOpenChange = (open: boolean) => {
    setCreateOpen(open)
    if (!open) setCreateProjectId(null)
  }

  const load = useCallback(() => {
    void fetchRepos()
  }, [fetchRepos])

  const runResync = (r: Repository) => {
    setResyncingId(r.id)
    setOptimistic(r.id, "queued")
    api
      .triggerResync(r.id)
      .then((res) => {
        setError(null)
        const n = (res as { deletedNodes?: number }).deletedNodes
        setFeedback(
          n != null
            ? `Resync encolado. Se borraron ${n} nodos del grafo; la reindexación corre en segundo plano.`
            : "Resync encolado. La reindexación corre en segundo plano.",
        )
        setTimeout(() => setFeedback(null), 6000)
        void refreshActiveJobs()
        load()
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => {
        setResyncingId(null)
        setResyncTarget(null)
      })
  }

  const runDelete = (r: Repository) => {
    setDeletingId(r.id)
    api
      .deleteRepository(r.id)
      .then(() => load())
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => {
        setDeletingId(null)
        setDeleteTarget(null)
      })
  }

  const columns = useMemo<ColumnDef<Repository>[]>(
    () => [
      {
        accessorKey: "provider",
        header: "Provider",
        cell: (info) => (
          <span className="font-mono text-xs capitalize text-[var(--foreground)]">{info.getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "projectKey",
        header: "Project",
        cell: (info) => {
          const value = info.getValue<string>();
          return <span className="font-mono text-sm text-[var(--foreground)]">{value}</span>;
        },
      },
      {
        accessorKey: "repoSlug",
        header: "Repo",
        cell: (info) => {
          const value = info.getValue<string>();
          return <span className="font-mono text-sm text-[var(--foreground)]">{value}</span>;
        },
      },
      {
        accessorKey: "defaultBranch",
        header: "Branch",
        cell: (info) => (
          <span className="font-mono text-sm text-[var(--foreground-muted)]">{info.getValue<string>() || "—"}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <div className="flex items-center">
            <StatusBadge status={displayStatus(row.original.id, row.original.status)} />
          </div>
        ),
      },
      {
        accessorKey: "id",
        header: "ID (MCP)",
        cell: ({ row }) => {
          const repoId = row.original.id;
          return (
            <code
              role="button"
              tabIndex={0}
              onClick={() => void navigator.clipboard.writeText(repoId)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void navigator.clipboard.writeText(repoId);
              }}
              title={`${repoId} — clic para copiar`}
              className="cursor-pointer rounded-md border border-transparent bg-[color-mix(in_oklch,var(--muted)_38%,var(--card))] px-1.5 py-0.5 font-mono text-xs text-[var(--foreground)] transition-colors hover:border-[var(--border)] hover:bg-[color-mix(in_oklch,var(--muted)_55%,var(--card))]"
            >
              {repoId}
            </code>
          );
        },
      },
      {
        accessorKey: "lastSyncAt",
        header: "Último sync",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-[var(--foreground-muted)]">
            {row.original.lastSyncAt ? new Date(row.original.lastSyncAt).toLocaleString() : "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        meta: {
          cellClassName: "text-right",
        },
        cell: ({ row }) => {
          const r = row.original;
          const compactBtn =
            "h-7 shrink-0 rounded-md px-1.5 text-[11px] font-medium leading-none";
          return (
            <div className="flex flex-nowrap items-center justify-end gap-0.5">
              <Button variant="outline" size="sm" className={cn(compactBtn, "border-[var(--border)]")} asChild>
                <Link to={`/repos/${r.id}`}>Ver</Link>
              </Button>
              <Button variant="outline" size="sm" className={cn(compactBtn, "border-[var(--border)]")} asChild>
                <Link to={`/repos/${r.id}/edit`}>Editar</Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={cn(compactBtn, "border-[var(--border)]")}
                disabled={resyncingId === r.id || deletingId === r.id}
                onClick={() => setResyncTarget(r)}
              >
                {resyncingId === r.id ? "Resync…" : "Resync"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  compactBtn,
                  "border-[color-mix(in_oklch,var(--destructive)_45%,var(--border))] text-[var(--destructive)] hover:bg-[color-mix(in_oklch,var(--destructive)_10%,transparent)]",
                )}
                disabled={deletingId === r.id || resyncingId === r.id}
                onClick={() => setDeleteTarget(r)}
              >
                {deletingId === r.id ? "…" : "Eliminar"}
              </Button>
            </div>
          );
        },
      },
    ],
    [deletingId, resyncingId, displayStatus],
  );

  return (
    <div className="space-y-10">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-4xl font-semibold tracking-tight text-[var(--foreground)]">Repositorios</h1>
          <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--foreground-muted)] transition-colors",
                  "hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)] hover:text-[var(--primary)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
                )}
                aria-label="Información: módulo Repositorios"
              >
                <Info className="size-5" strokeWidth={1.75} aria-hidden />
              </button>
            </HoverCardTrigger>
            <HoverCardContent
              side="bottom"
              align="start"
              className="w-[min(22rem,calc(100vw-2rem))] max-w-md border-[var(--border)] bg-[var(--card)] p-4 text-sm leading-relaxed text-[var(--foreground)] shadow-md"
            >
                <p className="m-0 text-[var(--foreground-muted)]">{REPOSITORIES_MODULE_HELP}</p>
            </HoverCardContent>
          </HoverCard>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--foreground-muted)]">
          Repositorios sincronizados con FalkorSpecs: ingest, webhooks y jobs. Ordena columnas o filtra por texto en la
          tabla.
        </p>
      </div>

      {feedback ? (
        <Alert className="border-[var(--border)] bg-[var(--card)]">
          <AlertTitle>Listo</AlertTitle>
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <section className={panelClass}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-6 w-40 rounded-lg" />
              <Skeleton className="h-4 w-56 rounded-lg" />
            </div>
            <Skeleton className="h-11 w-full rounded-xl sm:w-44" />
          </div>
          <div className="mt-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        </section>
      ) : (
        <section className={panelClass}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Repositorios</h2>
              <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                {repos.length === 1 ? "1 repositorio registrado" : `${repos.length} repositorios registrados`}
              </p>
            </div>
            <Button
              type="button"
              className="h-11 w-full shrink-0 touch-manipulation rounded-xl sm:w-auto"
              onClick={() => {
                setCreateProjectId(null)
                setCreateOpen(true)
              }}
            >
              {NEW_REPOSITORY_LABEL}
            </Button>
          </div>

          <div className="mt-8 min-w-0">
            {repos.length === 0 ? (
              <div
                className={cn(
                  "flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)]",
                  "bg-[color-mix(in_oklch,var(--muted)_45%,transparent)] px-6 py-14 text-center",
                )}
              >
                <div className="flex size-12 items-center justify-center rounded-2xl bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[var(--primary)]">
                  <GitBranch className="size-6" strokeWidth={1.75} aria-hidden />
                </div>
                <p className="mt-4 text-sm font-semibold text-[var(--foreground)]">No hay repositorios configurados</p>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-[var(--foreground-muted)]">
                  Conecta Bitbucket o GitHub con una credencial y registra el primer repo para empezar la ingesta y los
                  webhooks.
                </p>
                <Button
                  type="button"
                  className="mt-6 h-11 rounded-xl"
                  onClick={() => {
                    setCreateProjectId(null)
                    setCreateOpen(true)
                  }}
                >
                  {NEW_REPOSITORY_LABEL}
                </Button>
              </div>
            ) : (
              <DataTable
                columns={columns}
                data={repos}
                filterPlaceholder="Filtrar por provider, proyecto, repo, branch, estado o ID…"
                tableClassName="min-w-0"
              />
            )}
          </div>
        </section>
      )}

      <CreateRepoDialog
        open={createOpen}
        onOpenChange={handleCreateOpenChange}
        defaultProjectId={createProjectId}
      />

      <Dialog open={Boolean(resyncTarget)} onOpenChange={(o) => !o && !resyncingId && setResyncTarget(null)}>
        <DialogContent className="rounded-2xl border-[var(--border)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--foreground)]">Re-sincronizar repositorio</DialogTitle>
            <DialogDescription className="text-[var(--foreground-muted)]">
              {resyncTarget ? (
                <>
                  ¿Re-sincronizar{" "}
                  <span className="font-mono font-medium text-[var(--foreground)]">
                    {resyncTarget.projectKey}/{resyncTarget.repoSlug}
                  </span>
                  ? Se borrará el índice actual y se volverá a indexar desde cero.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl border-[var(--border)]"
              disabled={Boolean(resyncingId)}
              onClick={() => setResyncTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="h-11 rounded-xl"
              disabled={Boolean(resyncingId) || !resyncTarget}
              onClick={() => resyncTarget && runResync(resyncTarget)}
            >
              {resyncingId ? "Encolando…" : "Confirmar resync"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && !deletingId && setDeleteTarget(null)}>
        <DialogContent className="rounded-2xl border-[var(--border)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--foreground)]">Eliminar repositorio</DialogTitle>
            <DialogDescription className="text-[var(--foreground-muted)]">
              {deleteTarget ? (
                <>
                  ¿Eliminar{" "}
                  <span className="font-mono font-medium text-[var(--foreground)]">
                    {deleteTarget.projectKey}/{deleteTarget.repoSlug}
                  </span>
                  ? Se borrarán jobs e índice asociados. Esta acción no se puede deshacer.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl border-[var(--border)]"
              disabled={Boolean(deletingId)}
              onClick={() => setDeleteTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11 rounded-xl"
              disabled={Boolean(deletingId) || !deleteTarget}
              onClick={() => deleteTarget && runDelete(deleteTarget)}
            >
              {deletingId ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
