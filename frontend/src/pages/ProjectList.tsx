/**
 * @fileoverview Lista de proyectos multi-root: KPIs, catálogo en tabla y salud de ingesta (ready vs total).
 */
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { CreateProjectDialog, CREATE_PROJECT_LABEL } from "@/components/projects/CreateProjectDialog"
import { AlertTriangle, CheckCircle2, FolderInput, Info, Kanban } from "lucide-react"
import { api } from "@/api"
import type { Project } from "@/types"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { DashboardMetricCard } from "@/components/dashboard/DashboardMetricCard"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"

const PROJECTS_MODULE_HELP =
  "Cada proyecto agrupa varios repositorios (multi-root). La columna Ingesta resume cuántos repos están en estado ready frente al total, según el API. Asigna un dominio de arquitectura en el detalle del proyecto para gobierno C4 y shards Falkor."

const panelClass = cn(
  "rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm",
  "transition-shadow duration-[var(--transition-base)] hover:shadow-md",
)

function ingestHealth(repos: Project["repositories"]): { pct: number; ready: number; total: number } {
  const total = repos.length
  if (total === 0) return { pct: 0, ready: 0, total: 0 }
  const ready = repos.filter((r) => r.status === "ready").length
  return { ready, total, pct: Math.round((ready / total) * 100) }
}

function getProjectDisplayName(project: Project): string {
  if (project.name?.trim()) return project.name.trim()
  const first = project.repositories[0]
  if (first) return `${first.projectKey}/${first.repoSlug}`
  return project.id.slice(0, 8)
}

function handleCopyProjectId(projectId: string) {
  void navigator.clipboard.writeText(projectId)
}

/** Lista de proyectos con KPIs y tabla alineada al módulo Dominios. */
export function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    api
      .getProjects()
      .then(setProjects)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  const fullyReadyCount = useMemo(
    () =>
      projects.filter((p) => {
        const { ready, total } = ingestHealth(p.repositories)
        return total > 0 && ready === total
      }).length,
    [projects],
  )

  const needsAttentionCount = useMemo(
    () =>
      projects.filter((p) => {
        const { ready, total } = ingestHealth(p.repositories)
        if (total === 0) return true
        return ready < total
      }).length,
    [projects],
  )

  const withDomainCount = useMemo(
    () => projects.filter((p) => Boolean(p.domainId && p.domainName)).length,
    [projects],
  )

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="text-4xl font-semibold tracking-tight text-[var(--foreground)]">Proyectos</h1>
          <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--foreground-muted)] transition-colors",
                  "hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)] hover:text-[var(--primary)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
                )}
                aria-label="Información: para qué sirve el módulo Proyectos"
              >
                <Info className="size-5" strokeWidth={1.75} aria-hidden />
              </button>
            </HoverCardTrigger>
            <HoverCardContent
              side="bottom"
              align="start"
              className="w-[min(22rem,calc(100vw-2rem))] max-w-md border-[var(--border)] bg-[var(--card)] p-4 text-sm leading-relaxed text-[var(--foreground)] shadow-md"
            >
              <p className="m-0 text-[var(--foreground-muted)]">{PROJECTS_MODULE_HELP}</p>
            </HoverCardContent>
          </HoverCard>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
          <Button type="button" className="rounded-xl touch-manipulation" onClick={() => setCreateOpen(true)}>
            {CREATE_PROJECT_LABEL}
          </Button>
        </div>
      </div>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-36 rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardMetricCard
            title="Proyectos"
            icon={Kanban}
            value={projects.length}
            trend={{ direction: "neutral", label: "Catálogo" }}
            footer={
              <span className="text-[var(--foreground-subtle)]">
                Multi-root: agrupa repositorios y contexto para chat e índices.
              </span>
            }
          />
          <DashboardMetricCard
            title="Ingesta al día"
            icon={CheckCircle2}
            iconTone="success"
            value={fullyReadyCount}
            trend={
              fullyReadyCount === projects.length && projects.length > 0
                ? { direction: "up", label: "Completo" }
                : { direction: "neutral", label: "Repos ready" }
            }
            footer={
              <span className="text-[var(--foreground-subtle)]">
                Todos los repos en <span className="font-mono text-xs">ready</span> cuando el proyecto tiene al menos
                un repo.
              </span>
            }
          />
          <DashboardMetricCard
            title="A revisar"
            icon={AlertTriangle}
            iconTone={needsAttentionCount === 0 ? "success" : "muted"}
            value={needsAttentionCount}
            trend={
              needsAttentionCount === 0
                ? { direction: "up", label: "En orden" }
                : { direction: "neutral", label: "Sync / repos" }
            }
            footer={
              <span className="text-[var(--foreground-subtle)]">
                Sin repositorios o con algún repo que aún no está <span className="font-mono text-xs">ready</span>.
              </span>
            }
          />
          <DashboardMetricCard
            title="Con dominio"
            icon={FolderInput}
            iconTone="muted"
            value={withDomainCount}
            trend={
              withDomainCount === projects.length && projects.length > 0
                ? { direction: "up", label: "C4 / gobierno" }
                : { direction: "neutral", label: "Arquitectura" }
            }
            footer={
              <span className="text-[var(--foreground-subtle)]">
                Con <span className="font-mono text-xs">domain_id</span> para visibilidad C4 y whitelist en Arquitectura.
              </span>
            }
          />
        </div>
      )}

      <section className={panelClass}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-[var(--foreground)]">Catálogo</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--foreground-muted)]">
              <span className="font-medium text-[var(--foreground)]">Ingesta</span> muestra{" "}
              <span className="font-mono text-[11px]">ready / total</span> por proyecto.{" "}
              <span className="font-medium text-[var(--foreground)]">ID (MCP)</span> es el identificador estable del
              proyecto; clic para copiar.
            </p>
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ) : projects.length === 0 ? (
            <div
              className={cn(
                "flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)]",
                "bg-[color-mix(in_oklch,var(--muted)_45%,transparent)] px-6 py-14 text-center",
              )}
            >
              <div className="flex size-12 items-center justify-center rounded-2xl bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[var(--primary)]">
                <Kanban className="size-6" strokeWidth={1.75} aria-hidden />
              </div>
              <p className="mt-4 text-sm font-semibold text-[var(--foreground)]">No hay proyectos todavía</p>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-[var(--foreground-muted)]">
                Crea el primero y luego vincula repositorios desde el detalle. Podrás ver la salud de ingesta y asignar
                dominio para C4.
              </p>
              <Button type="button" className="mt-6 rounded-xl" onClick={() => setCreateOpen(true)}>
                {CREATE_PROJECT_LABEL}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
              <Table>
                <TableHeader>
                  <TableRow className="border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_55%,transparent)] hover:bg-[color-mix(in_oklch,var(--muted)_55%,transparent)]">
                    <TableHead className="min-w-[10rem] text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                      Proyecto
                    </TableHead>
                    <TableHead className="min-w-[7rem] text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                      Dominio
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                      Repos
                    </TableHead>
                    <TableHead className="min-w-[11rem] text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                      Ingesta
                    </TableHead>
                    <TableHead className="hidden min-w-[8rem] text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)] md:table-cell">
                      ID (MCP)
                    </TableHead>
                    <TableHead className="w-[120px] text-right text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p) => {
                    const h = ingestHealth(p.repositories)
                    const name = getProjectDisplayName(p)
                    return (
                      <TableRow key={p.id} className="border-[var(--border)]">
                        <TableCell className="align-top">
                          <Link
                            to={`/projects/${p.id}`}
                            className="font-medium text-[var(--foreground)] hover:text-[var(--primary)] hover:underline"
                          >
                            {name}
                          </Link>
                          {p.description ? (
                            <p className="mt-1 line-clamp-2 text-xs text-[var(--foreground-muted)]">{p.description}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="align-top">
                          {p.domainName ? (
                            <Badge
                              variant="outline"
                              className="border font-normal text-[10px]"
                              style={{ borderColor: p.domainColor ?? undefined, color: "var(--foreground)" }}
                            >
                              {p.domainName}
                            </Badge>
                          ) : (
                            <span className="text-sm text-[var(--foreground-muted)]">—</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top text-right tabular-nums text-sm text-[var(--foreground)]">
                          {p.repositories.length}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="max-w-[14rem] space-y-1.5">
                            <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--foreground-muted)]">
                              <span>Estado</span>
                              <span className="font-mono tabular-nums">
                                {h.total === 0 ? "—" : `${h.ready}/${h.total} ready`}
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
                              <div
                                className="h-full rounded-full bg-[var(--success)] transition-all duration-500"
                                style={{ width: `${h.total === 0 ? 0 : h.pct}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden align-top md:table-cell">
                          <code
                            role="button"
                            tabIndex={0}
                            onClick={() => handleCopyProjectId(p.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                handleCopyProjectId(p.id)
                              }
                            }}
                            title="Clic para copiar"
                            className="block max-w-[10rem] cursor-pointer truncate rounded-md bg-[var(--muted)] px-2 py-0.5 font-mono text-[11px] text-[var(--foreground-muted)] hover:bg-[color-mix(in_oklch,var(--muted)_85%,var(--foreground))]"
                          >
                            {p.id}
                          </code>
                        </TableCell>
                        <TableCell className="text-right align-top">
                          <Button variant="secondary" size="sm" className="rounded-xl touch-manipulation" asChild>
                            <Link to={`/projects/${p.id}`}>Ver</Link>
                          </Button>
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
    </div>
  )
}
