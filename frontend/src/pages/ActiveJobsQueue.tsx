/**
 * @fileoverview Cola global de sync: en cola / en curso + jobs terminados recientes (auditoría). UI alineada a Repositorios / Proyectos.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { api } from "@/api"
import type { ActiveSyncJob } from "@/types"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { SyncPipelineModal } from "@/pages/RepoDetail/SyncPipelineModal"
import { formatRunningSyncHeadline } from "@/pages/RepoDetail/syncPipeline"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { cn } from "@/lib/utils"
import { Info, ListOrdered, Loader2, RefreshCw } from "lucide-react"

const POLL_MS = 5000

const SYNC_QUEUE_MODULE_HELP =
  "Jobs en cola o en ejecución y los últimos terminados con resumen de indexación (auditoría). La vista se actualiza sola cada 5 s; también puedes forzar con «Actualizar». Usa Cancelar para jobs encolados o en curso (quita de Redis y marca estado). Borrar quita solo el registro en base de datos cuando el job ya no está en ejecución; no uses borrar masivo sobre jobs activos."

const panelClass = cn(
  "rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm",
  "transition-shadow duration-[var(--transition-base)] hover:shadow-md",
)

function isActiveStatus(s: string): boolean {
  return s === "queued" || s === "running"
}

/** No borrar filas en ejecución (riesgo de inconsistencia con el worker). */
function canSelectJobForDelete(j: ActiveSyncJob): boolean {
  return j.status !== "running"
}

/** Resume progreso en vivo (payload mezclado durante el sync). */
function progressHint(
  payload: Record<string, unknown> | null | undefined,
  status: string,
): string | null {
  if (status === "queued" || status === "running") {
    return formatRunningSyncHeadline(payload, status === "queued" ? "queued" : "running")
  }
  return null
}

/** Extrae línea de auditoría y listas indexados/omitidos desde el payload al completar (full o webhook). */
function auditFromPayload(job: ActiveSyncJob): {
  summary: string
  indexedPaths: string[]
  indexedTotal: number
  omitted: string[]
  errorLine: string | null
} {
  const { status, payload, errorMessage } = job
  if (status === "failed") {
    return {
      summary: "—",
      indexedPaths: [],
      indexedTotal: 0,
      omitted: [],
      errorLine: errorMessage?.trim() || "Error desconocido",
    }
  }
  if (status !== "completed" || !payload) {
    return { summary: "—", indexedPaths: [], indexedTotal: 0, omitted: [], errorLine: null }
  }
  const indexed = typeof payload.indexed === "number" ? payload.indexed : undefined
  const skipped = typeof payload.skipped === "number" ? payload.skipped : undefined
  const total = typeof payload.total === "number" ? payload.total : undefined
  const deleted = typeof payload.deleted === "number" ? payload.deleted : undefined
  const parts: string[] = []
  if (indexed !== undefined) parts.push(`${indexed} indexados`)
  if (skipped !== undefined) parts.push(`${skipped} omitidos`)
  if (total !== undefined) parts.push(`${total} archivos listados`)
  if (deleted !== undefined) parts.push(`${deleted} quitados del índice`)
  let omitted: string[] = []
  if (Array.isArray(payload.skippedPaths)) {
    omitted = payload.skippedPaths.filter((x): x is string => typeof x === "string")
  } else if (payload.skippedPathsByReason && typeof payload.skippedPathsByReason === "object") {
    const o = payload.skippedPathsByReason as Record<string, unknown>
    for (const k of ["fetch", "parse", "index"] as const) {
      const arr = o[k]
      if (Array.isArray(arr)) omitted.push(...arr.filter((x): x is string => typeof x === "string"))
    }
  }
  let indexedPaths: string[] = []
  if (Array.isArray(payload.paths)) {
    indexedPaths = payload.paths.filter((x): x is string => typeof x === "string")
  }
  return {
    summary: parts.length ? parts.join(" · ") : "—",
    indexedPaths,
    indexedTotal: indexed ?? 0,
    omitted,
    errorLine: null,
  }
}

export function ActiveJobsQueue() {
  const [jobs, setJobs] = useState<ActiveSyncJob[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set())
  const [deletingJobs, setDeletingJobs] = useState(false)
  const [syncingRepoId, setSyncingRepoId] = useState<string | null>(null)
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null)
  const [cancellingJobKey, setCancellingJobKey] = useState<string | null>(null)
  const [pipelineModalJob, setPipelineModalJob] = useState<ActiveSyncJob | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null)

  const [deleteOneTarget, setDeleteOneTarget] = useState<{ repositoryId: string; jobId: string } | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [resyncTarget, setResyncTarget] = useState<{ repositoryId: string; repoLabel: string } | null>(null)
  const [cancelTarget, setCancelTarget] = useState<{
    repositoryId: string
    jobId: string
    status: string
    repoLabel: string
  } | null>(null)

  const load = useCallback(() => {
    return api
      .getActiveSyncJobs()
      .then((list) => {
        setJobs(list)
        setLastFetchedAt(new Date())
        setSelectedJobIds((prev) => {
          const ids = new Set(list.map((j) => j.id))
          return new Set([...prev].filter((id) => ids.has(id)))
        })
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const t = window.setInterval(() => void load(), POLL_MS)
    return () => window.clearInterval(t)
  }, [load])

  const counts = useMemo(() => {
    const active = jobs.filter((j) => isActiveStatus(j.status)).length
    const done = jobs.length - active
    return { active, done }
  }, [jobs])

  const selectableIds = useMemo(
    () => jobs.filter(canSelectJobForDelete).map((j) => j.id),
    [jobs],
  )
  const allSelectableSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedJobIds.has(id))
  const hasSelection = selectedJobIds.size > 0

  const toggleJobSelection = useCallback((jobId: string) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev)
      if (next.has(jobId)) next.delete(jobId)
      else next.add(jobId)
      return next
    })
  }, [])

  const toggleAllSelectable = useCallback(() => {
    if (allSelectableSelected) setSelectedJobIds(new Set())
    else setSelectedJobIds(new Set(selectableIds))
  }, [allSelectableSelected, selectableIds])

  const executeDeleteOne = useCallback(async () => {
    if (!deleteOneTarget) return
    const { repositoryId, jobId } = deleteOneTarget
    setDeletingJobs(true)
    try {
      await api.deleteJob(repositoryId, jobId)
      setSelectedJobIds((s) => {
        const n = new Set(s)
        n.delete(jobId)
        return n
      })
      setDeleteOneTarget(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setDeletingJobs(false)
    }
  }, [deleteOneTarget, load])

  const executeBulkDelete = useCallback(async () => {
    if (selectedJobIds.size === 0) return
    setBulkDeleteOpen(false)
    setDeletingJobs(true)
    try {
      const pairs = [...selectedJobIds]
        .map((jobId) => {
          const job = jobs.find((j) => j.id === jobId)
          return job ? { repositoryId: job.repositoryId, jobId } : null
        })
        .filter((p): p is { repositoryId: string; jobId: string } => p !== null)
      await Promise.all(pairs.map((p) => api.deleteJob(p.repositoryId, p.jobId)))
      setSelectedJobIds(new Set())
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setDeletingJobs(false)
    }
  }, [selectedJobIds, jobs, load])

  const onTriggerSync = useCallback(
    async (repositoryId: string) => {
      setSyncingRepoId(repositoryId)
      setSyncFeedback(null)
      try {
        const res = await api.triggerSync(repositoryId)
        setSyncFeedback(
          res.queued ? `Sync encolado (job ${res.jobId.slice(0, 8)}…)` : "Sync solicitado",
        )
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setSyncingRepoId(null)
      }
    },
    [load],
  )

  const executeResync = useCallback(async () => {
    if (!resyncTarget) return
    const { repositoryId } = resyncTarget
    setResyncTarget(null)
    setSyncingRepoId(repositoryId)
    setSyncFeedback(null)
    try {
      const res = await api.triggerResync(repositoryId)
      const extra = res.deletedNodes != null ? ` · ${res.deletedNodes} nodos eliminados del grafo` : ""
      setSyncFeedback(
        res.queued ? `Resync encolado (job ${res.jobId.slice(0, 8)}…)${extra}` : "Resync solicitado",
      )
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSyncingRepoId(null)
    }
  }, [resyncTarget, load])

  const executeCancelJob = useCallback(async () => {
    if (!cancelTarget) return
    const { repositoryId, jobId } = cancelTarget
    setCancelTarget(null)
    const key = `${repositoryId}:${jobId}`
    setCancellingJobKey(key)
    setSyncFeedback(null)
    try {
      const res = await api.cancelSyncJob(repositoryId, jobId)
      setSyncFeedback(
        res.bullRemoved > 0
          ? `Job cancelado · ${res.bullRemoved} entrada(s) quitada(s) de Redis`
          : "Job cancelado (no había job en Redis para este id)",
      )
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCancellingJobKey(null)
    }
  }, [cancelTarget, load])

  const handleManualRefresh = () => {
    setRefreshing(true)
    void load()
  }

  const lastFetchedLabel = lastFetchedAt
    ? lastFetchedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-4xl font-semibold tracking-tight text-[var(--foreground)]">Cola de sincronización</h1>
            <HoverCard openDelay={200} closeDelay={100}>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--foreground-muted)] transition-colors",
                    "hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)] hover:text-[var(--primary)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
                  )}
                  aria-label="Información: cola de sincronización"
                >
                  <Info className="size-5" strokeWidth={1.75} aria-hidden />
                </button>
              </HoverCardTrigger>
              <HoverCardContent
                side="bottom"
                align="start"
                className="w-[min(22rem,calc(100vw-2rem))] max-w-md border-[var(--border)] bg-[var(--card)] p-4 text-sm leading-relaxed text-[var(--foreground)] shadow-md"
              >
                <p className="m-0 text-[var(--foreground-muted)]">{SYNC_QUEUE_MODULE_HELP}</p>
              </HoverCardContent>
            </HoverCard>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--foreground-muted)]">
            Ventana en vivo de jobs de ingest (Redis/Bull). Se refresca cada {POLL_MS / 1000} s
            {lastFetchedLabel ? (
              <>
                {" "}
                · última lectura <span className="font-mono text-xs">{lastFetchedLabel}</span>
              </>
            ) : null}
            .
          </p>
        </div>
      </div>

      {syncFeedback ? (
        <Alert className="border-[var(--border)] bg-[var(--card)]">
          <AlertTitle>Listo</AlertTitle>
          <AlertDescription>{syncFeedback}</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading && jobs.length === 0 ? (
        <section className={panelClass}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-6 w-36 rounded-lg" />
              <Skeleton className="h-4 w-72 rounded-lg" />
            </div>
            <Skeleton className="h-11 w-36 rounded-xl" />
          </div>
          <div className="mt-8 space-y-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </section>
      ) : (
        <section className={panelClass}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Trabajos</h2>
              <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                {jobs.length === 0
                  ? "Sin jobs en la ventana reciente."
                  : `${counts.active} en cola o en curso${counts.done > 0 ? ` · ${counts.done} terminado(s) reciente(s)` : ""}.`}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end lg:w-auto">
              {hasSelection ? (
                <Button
                  type="button"
                  variant="destructive"
                  className="h-11 w-full shrink-0 rounded-xl sm:w-auto"
                  disabled={deletingJobs}
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  Borrar seleccionados ({selectedJobIds.size})
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full shrink-0 rounded-xl border-[var(--border)] sm:w-auto"
                onClick={handleManualRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={cn("mr-2 size-4", refreshing && "animate-spin")} aria-hidden />
                Actualizar
              </Button>
            </div>
          </div>

          <div className="mt-8 min-w-0">
            {jobs.length === 0 ? (
              <div
                className={cn(
                  "flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)]",
                  "bg-[color-mix(in_oklch,var(--muted)_45%,transparent)] px-6 py-14 text-center",
                )}
              >
                <div className="flex size-12 items-center justify-center rounded-2xl bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[var(--primary)]">
                  <ListOrdered className="size-6" strokeWidth={1.75} aria-hidden />
                </div>
                <p className="mt-4 text-sm font-semibold text-[var(--foreground)]">No hay jobs recientes</p>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-[var(--foreground-muted)]">
                  Cuando encoles un sync o un resync desde un repositorio o un webhook dispare ingest, aparecerán aquí
                  con estado, tiempos y auditoría.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-6 h-11 rounded-xl border-[var(--border)] bg-[var(--card)]"
                  onClick={handleManualRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw className={cn("mr-2 size-4", refreshing && "animate-spin")} aria-hidden />
                  Comprobar de nuevo
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_55%,transparent)] hover:bg-[color-mix(in_oklch,var(--muted)_55%,transparent)]">
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          checked={allSelectableSelected}
                          onChange={toggleAllSelectable}
                          disabled={selectableIds.length === 0}
                          title={
                            selectableIds.length === 0
                              ? "No hay filas eliminables (hay un job en ejecución)"
                              : "Seleccionar todos los que se pueden borrar"
                          }
                          className="rounded border-[var(--border)]"
                        />
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                        Estado
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                        Repositorio
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                        Tipo
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                        Inicio
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                        Fin
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                        Auditoría / progreso
                      </TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                        Acciones
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((j) => {
                      const selectable = canSelectJobForDelete(j)
                      const scope =
                        typeof j.payload?.onlyProjectId === "string" ? j.payload.onlyProjectId : null
                      const active = isActiveStatus(j.status)
                      const prog = active ? progressHint(j.payload, j.status) : null
                      const audit = auditFromPayload(j)
                      const showOmitted = audit.omitted.length > 0
                      const showIndexed = audit.indexedPaths.length > 0
                      const repoLabel = `${j.repository.projectKey}/${j.repository.repoSlug}`
                      return (
                        <TableRow key={j.id} className="border-[var(--border)]">
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedJobIds.has(j.id)}
                              onChange={() => toggleJobSelection(j.id)}
                              disabled={!selectable}
                              title={
                                selectable
                                  ? "Seleccionar para borrar del historial"
                                  : "No se puede borrar mientras el job está en ejecución"
                              }
                              className="rounded border-[var(--border)]"
                            />
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={j.status} />
                          </TableCell>
                          <TableCell className="min-w-[10rem]">
                            <div className="font-mono text-sm text-[var(--foreground)]">{repoLabel}</div>
                            {j.repository.defaultBranch?.trim() ? (
                              <div className="mt-0.5 text-xs text-[var(--foreground-muted)]">
                                {j.repository.defaultBranch}
                              </div>
                            ) : null}
                            {scope ? (
                              <div className="mt-0.5 text-xs text-[var(--foreground-muted)]">
                                Solo proyecto: {scope}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="capitalize text-[var(--foreground)]">{j.type}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-[var(--foreground-muted)]">
                            {new Date(j.startedAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-[var(--foreground-muted)]">
                            {j.finishedAt ? new Date(j.finishedAt).toLocaleString() : "—"}
                          </TableCell>
                          <TableCell className="max-w-[28rem] text-sm">
                            {active && prog && (
                              <span className="text-[var(--foreground-muted)]">{prog}</span>
                            )}
                            {active && !prog && (
                              <span className="text-[var(--foreground-muted)]">En proceso…</span>
                            )}
                            {!active && j.status === "completed" && (
                              <div className="space-y-1">
                                <div className="text-[var(--foreground)]">{audit.summary}</div>
                                {showIndexed && (
                                  <details className="text-xs text-[var(--foreground-muted)]">
                                    <summary className="cursor-pointer select-none hover:underline">
                                      Ver indexados ({audit.indexedPaths.length}
                                      {audit.indexedTotal > audit.indexedPaths.length
                                        ? ` de ${audit.indexedTotal}`
                                        : ""}
                                      )
                                    </summary>
                                    <ul className="mt-1 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-3">
                                      {audit.indexedPaths.map((p) => (
                                        <li key={p} className="break-all font-mono">
                                          {p}
                                        </li>
                                      ))}
                                    </ul>
                                  </details>
                                )}
                                {showOmitted && (
                                  <details className="text-xs text-[var(--foreground-muted)]">
                                    <summary className="cursor-pointer select-none hover:underline">
                                      Ver omitidos ({audit.omitted.length})
                                    </summary>
                                    <ul className="mt-1 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-3">
                                      {audit.omitted.map((p) => (
                                        <li key={p} className="break-all font-mono">
                                          {p}
                                        </li>
                                      ))}
                                    </ul>
                                  </details>
                                )}
                              </div>
                            )}
                            {!active && j.status === "failed" && audit.errorLine && (
                              <span className="break-words text-xs text-[var(--destructive)]">{audit.errorLine}</span>
                            )}
                            {j.type === "full" && (
                              <div className="mt-1">
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 text-xs text-[var(--primary)] underline underline-offset-4"
                                  type="button"
                                  title="Ver fases del pipeline (parseo, Falkor, embeddings)"
                                  onClick={() => setPipelineModalJob(j)}
                                >
                                  Pasos del sync
                                </Button>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            <div className="flex flex-wrap justify-end gap-1.5">
                              {active && (j.status === "queued" || j.status === "running") && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-9 rounded-xl"
                                  title="Quita el job de Redis y lo marca como cancelado en la base de datos"
                                  disabled={deletingJobs || cancellingJobKey === `${j.repositoryId}:${j.id}`}
                                  onClick={() =>
                                    setCancelTarget({
                                      repositoryId: j.repositoryId,
                                      jobId: j.id,
                                      status: j.status,
                                      repoLabel,
                                    })
                                  }
                                >
                                  {cancellingJobKey === `${j.repositoryId}:${j.id}` ? (
                                    <>
                                      <Loader2 className="mr-1 size-4 animate-spin" aria-hidden />
                                      Cancelando…
                                    </>
                                  ) : (
                                    "Cancelar"
                                  )}
                                </Button>
                              )}
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-9 rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_40%,var(--card))]"
                                title="Encola un sync completo (misma acción que en la ficha del repo)"
                                disabled={deletingJobs || syncingRepoId === j.repositoryId}
                                onClick={() => void onTriggerSync(j.repositoryId)}
                              >
                                {syncingRepoId === j.repositoryId ? (
                                  <>
                                    <Loader2 className="mr-1 size-4 animate-spin" aria-hidden />
                                    Encolar…
                                  </>
                                ) : (
                                  "Encolar sync"
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 rounded-xl border-orange-500/50 text-orange-600 dark:text-orange-400"
                                title="Borra nodos del grafo para este repo y encola reindexación completa"
                                disabled={deletingJobs || syncingRepoId === j.repositoryId}
                                onClick={() =>
                                  setResyncTarget({ repositoryId: j.repositoryId, repoLabel })
                                }
                              >
                                Resync
                              </Button>
                              <Button variant="ghost" size="sm" className="h-9 rounded-xl" asChild>
                                <Link to={`/repos/${j.repositoryId}`}>Ver repo</Link>
                              </Button>
                              {selectable && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 rounded-xl text-[var(--destructive)] hover:text-[var(--destructive)]"
                                  disabled={deletingJobs}
                                  onClick={() =>
                                    setDeleteOneTarget({ repositoryId: j.repositoryId, jobId: j.id })
                                  }
                                >
                                  Borrar
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </section>
      )}

      <SyncPipelineModal
        open={pipelineModalJob !== null}
        onOpenChange={(open) => !open && setPipelineModalJob(null)}
        job={pipelineModalJob}
      />

      <Dialog open={deleteOneTarget !== null} onOpenChange={(o) => !o && !deletingJobs && setDeleteOneTarget(null)}>
        <DialogContent className="rounded-2xl border-[var(--border)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--foreground)]">Quitar job del historial</DialogTitle>
            <DialogDescription className="text-[var(--foreground-muted)]">
              Solo se elimina el registro en base de datos. No afecta a jobs en ejecución en Redis si ya terminaron allí.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl border-[var(--border)]"
              disabled={deletingJobs}
              onClick={() => setDeleteOneTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11 rounded-xl"
              disabled={deletingJobs}
              onClick={() => void executeDeleteOne()}
            >
              {deletingJobs ? "Borrando…" : "Borrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={(o) => !o && !deletingJobs && setBulkDeleteOpen(false)}>
        <DialogContent className="rounded-2xl border-[var(--border)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--foreground)]">Borrar jobs seleccionados</DialogTitle>
            <DialogDescription className="text-[var(--foreground-muted)]">
              ¿Eliminar {selectedJobIds.size} job(s) del historial? Solo se borran registros en base de datos (filas no
              seleccionables suelen ser jobs en ejecución).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl border-[var(--border)]"
              disabled={deletingJobs}
              onClick={() => setBulkDeleteOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11 rounded-xl"
              disabled={deletingJobs}
              onClick={() => void executeBulkDelete()}
            >
              {deletingJobs ? "Borrando…" : `Borrar ${selectedJobIds.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resyncTarget !== null} onOpenChange={(o) => !o && !syncingRepoId && setResyncTarget(null)}>
        <DialogContent className="rounded-2xl border-[var(--border)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--foreground)]">Re-sincronizar repositorio</DialogTitle>
            <DialogDescription className="text-[var(--foreground-muted)]">
              {resyncTarget ? (
                <>
                  ¿Re-sincronizar todo{" "}
                  <span className="font-mono font-medium text-[var(--foreground)]">{resyncTarget.repoLabel}</span>?
                  Se borrará el índice en Falkor para este repo y se volverá a indexar desde cero.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl border-[var(--border)]"
              disabled={Boolean(syncingRepoId)}
              onClick={() => setResyncTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="h-11 rounded-xl"
              disabled={Boolean(syncingRepoId) || !resyncTarget}
              onClick={() => void executeResync()}
            >
              {syncingRepoId ? "Encolando…" : "Confirmar resync"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelTarget !== null} onOpenChange={(o) => !o && !cancellingJobKey && setCancelTarget(null)}>
        <DialogContent className="rounded-2xl border-[var(--border)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--foreground)]">Cancelar job</DialogTitle>
            <DialogDescription className="text-[var(--foreground-muted)]">
              {cancelTarget ? (
                <>
                  {cancelTarget.status === "running" ? (
                    <>
                      ¿Cancelar el sync en curso de{" "}
                      <span className="font-mono font-medium text-[var(--foreground)]">{cancelTarget.repoLabel}</span>?
                      Se marcará como fallido y se quitará de Redis; el worker puede tardar unos segundos en detenerse.
                    </>
                  ) : (
                    <>
                      ¿Quitar de la cola el job encolado de{" "}
                      <span className="font-mono font-medium text-[var(--foreground)]">{cancelTarget.repoLabel}</span>{" "}
                      y marcarlo como cancelado?
                    </>
                  )}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl border-[var(--border)]"
              disabled={Boolean(cancellingJobKey)}
              onClick={() => setCancelTarget(null)}
            >
              Volver
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11 rounded-xl"
              disabled={Boolean(cancellingJobKey) || !cancelTarget}
              onClick={() => void executeCancelJob()}
            >
              {cancellingJobKey ? "Cancelando…" : "Confirmar cancelación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
