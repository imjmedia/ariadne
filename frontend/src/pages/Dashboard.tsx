/**
 * @fileoverview Dashboard: KPIs reales desde API (proyectos, repos, dominios, salud, operación sync).
 */
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { api } from "@/api"
import type { ActiveSyncJob, Domain, Project, Repository, SyncJob } from "@/types"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Activity,
  AlertCircle,
  Building2,
  CalendarClock,
  FolderKanban,
  GitBranch,
  KeyRound,
  Layers,
  ListTodo,
  OctagonAlert,
} from "lucide-react"
import { DashboardMetricCard } from "@/components/dashboard/DashboardMetricCard"
import type { DashboardMetricTrend } from "@/components/dashboard/DashboardMetricCard"
import { DashboardWeeklyBarsCard } from "@/components/dashboard/DashboardWeeklyBarsCard"
import { buildCurrentWeekSyncBuckets, countFailedSyncJobsInCurrentWeek } from "@/lib/weeklySyncActivity"

const STALE_SYNC_DAYS = 7

function repoHealth(repos: Repository[]): { ready: number; total: number; pct: number } {
  const total = repos.length
  if (total === 0) return { ready: 0, total: 0, pct: 0 }
  const ready = repos.filter((r) => r.status === "ready").length
  return { ready, total, pct: Math.round((ready / total) * 100) }
}

function resolveHealthTrend(pct: number, total: number): DashboardMetricTrend {
  if (total === 0) return { direction: "neutral", label: "Sin datos" }
  if (pct >= 95) return { direction: "up", label: "Óptimo" }
  if (pct >= 70) return { direction: "neutral", label: "En curso" }
  return { direction: "down", label: "Atención" }
}

function isRepoSyncStale(repo: Repository): boolean {
  if (repo.status === "pending") return false
  if (!repo.lastSyncAt) return true
  const ms = Date.now() - new Date(repo.lastSyncAt).getTime()
  if (Number.isNaN(ms)) return true
  return ms > STALE_SYNC_DAYS * 86400000
}

function trendWhenZeroGood(count: number): DashboardMetricTrend {
  if (count <= 0) return { direction: "up", label: "Sin incidencias" }
  return { direction: "down", label: "Revisar" }
}

function trendActiveQueue(active: number): DashboardMetricTrend {
  if (active <= 0) return { direction: "up", label: "Sin cola" }
  return { direction: "neutral", label: "En curso" }
}

function countActiveSyncJobs(jobs: ActiveSyncJob[]): number {
  return jobs.filter((j) => j.status === "queued" || j.status === "running").length
}

export function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [repos, setRepos] = useState<Repository[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [activeSyncJobs, setActiveSyncJobs] = useState<ActiveSyncJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [weekJobs, setWeekJobs] = useState<SyncJob[]>([])
  const [weekLoading, setWeekLoading] = useState(false)
  const [weekError, setWeekError] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    Promise.all([api.getProjects(), api.getRepositories(), api.getDomains(), api.getActiveSyncJobs()])
      .then(([p, r, d, active]) => {
        if (!cancel) {
          setProjects(p)
          setRepos(r)
          setDomains(d)
          setActiveSyncJobs(active)
        }
      })
      .catch((e) => {
        if (!cancel) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancel) setLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [])

  const health = useMemo(() => repoHealth(repos), [repos])
  const healthTrend = useMemo(
    () => resolveHealthTrend(health.pct, health.total),
    [health.pct, health.total],
  )

  const weekBuckets = useMemo(() => buildCurrentWeekSyncBuckets(weekJobs), [weekJobs])

  const activeQueueCount = useMemo(() => countActiveSyncJobs(activeSyncJobs), [activeSyncJobs])
  const reposInError = useMemo(() => repos.filter((r) => r.status === "error").length, [repos])
  const reposWithoutCredential = useMemo(
    () => repos.filter((r) => !r.credentialsRef?.trim()).length,
    [repos],
  )
  const reposSyncStale = useMemo(() => repos.filter((r) => isRepoSyncStale(r)).length, [repos])
  const failedJobsThisWeek = useMemo(() => countFailedSyncJobsInCurrentWeek(weekJobs), [weekJobs])
  const projectsWithoutDomain = useMemo(
    () => projects.filter((p) => !p.domainId?.trim()).length,
    [projects],
  )

  useEffect(() => {
    if (loading) return
    let cancel = false
    if (repos.length === 0) {
      setWeekJobs([])
      setWeekLoading(false)
      setWeekError(null)
      return
    }
    setWeekLoading(true)
    setWeekError(null)
    Promise.all(repos.map((r) => api.getJobs(r.id)))
      .then((arrays) => {
        if (cancel) return
        setWeekJobs(arrays.flat())
      })
      .catch((e) => {
        if (cancel) return
        setWeekJobs([])
        setWeekError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancel) setWeekLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [loading, repos])

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-10 w-64 max-w-full rounded-lg" />
          <Skeleton className="mt-2 h-5 w-96 max-w-full rounded-md" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={`a-${i}`} className="h-36 rounded-3xl" />
          ))}
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={`b-${i}`} className="h-36 rounded-3xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-3xl" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-[var(--foreground)]">Dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--foreground-muted)]">
          Resumen de gobierno de arquitectura: proyectos multi-root, repositorios indexados y dominios. Los datos
          provienen del servicio ingest en tiempo real.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          title="Proyectos"
          icon={FolderKanban}
          value={projects.length}
          trend={{ direction: "neutral", label: "Tiempo real" }}
          footer={
            <>
              <span className="block text-[var(--foreground-subtle)]">Inventario al cargar esta vista.</span>
              <Link to="/projects" className="mt-1 inline-block font-medium text-[var(--primary)] hover:underline">
                Ver listado
              </Link>
            </>
          }
        />

        <DashboardMetricCard
          title="Repositorios"
          icon={GitBranch}
          value={repos.length}
          trend={{ direction: "neutral", label: "Tiempo real" }}
          footer={
            <>
              <span className="block text-[var(--foreground-subtle)]">Índice The Forge.</span>
              <Link to="/repos" className="mt-1 inline-block font-medium text-[var(--primary)] hover:underline">
                Abrir The Forge
              </Link>
            </>
          }
        />

        <DashboardMetricCard
          title="Dominios"
          icon={Layers}
          value={domains.length}
          trend={{ direction: "neutral", label: "Tiempo real" }}
          footer={
            <>
              <span className="block text-[var(--foreground-subtle)]">Catálogo de bounded contexts.</span>
              <Link to="/domains" className="mt-1 inline-block font-medium text-[var(--primary)] hover:underline">
                Gestionar
              </Link>
            </>
          }
        />

        <DashboardMetricCard
          title="Salud ingesta"
          icon={Activity}
          iconTone="success"
          value={`${health.pct}%`}
          trend={healthTrend}
          footer={
            <span>
              {health.total === 0 ? (
                "Aún sin repositorios indexados."
              ) : (
                <>
                  {health.ready}/{health.total} repos en estado <span className="font-mono">ready</span>.
                </>
              )}
            </span>
          }
        />
      </div>

      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--foreground-subtle)]">
          Operación e integridad
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          <DashboardMetricCard
            title="Cola sync activa"
            icon={ListTodo}
            value={activeQueueCount}
            trend={trendActiveQueue(activeQueueCount)}
            footer={
              <>
                <span className="block text-[var(--foreground-subtle)]">
                  Jobs en cola o en ejecución (todos los repos).
                </span>
                <Link to="/jobs" className="mt-1 inline-block font-medium text-[var(--primary)] hover:underline">
                  Ver cola global
                </Link>
              </>
            }
          />

          <DashboardMetricCard
            title="Repos en error"
            icon={AlertCircle}
            iconTone="muted"
            value={reposInError}
            trend={trendWhenZeroGood(reposInError)}
            footer={
              <>
                <span className="block text-[var(--foreground-subtle)]">Estado de sincronización en error.</span>
                <Link to="/repos" className="mt-1 inline-block font-medium text-[var(--primary)] hover:underline">
                  Ir a repositorios
                </Link>
              </>
            }
          />

          <DashboardMetricCard
            title="Sin credencial"
            icon={KeyRound}
            iconTone="muted"
            value={reposWithoutCredential}
            trend={trendWhenZeroGood(reposWithoutCredential)}
            footer={
              <span className="block text-[var(--foreground-subtle)]">
                Repos sin credencial configurada; el remoto suele exigir token o app password.
              </span>
            }
          />

          <DashboardMetricCard
            title="Sync desactualizado"
            icon={CalendarClock}
            iconTone="muted"
            value={reposSyncStale}
            trend={trendWhenZeroGood(reposSyncStale)}
            footer={
              <span className="block text-[var(--foreground-subtle)]">
                Sin fecha de último sync o último sync hace más de {STALE_SYNC_DAYS} días (excluye pendientes).
              </span>
            }
          />

          <DashboardMetricCard
            title="Jobs fallidos (semana)"
            icon={OctagonAlert}
            iconTone="muted"
            value={failedJobsThisWeek}
            trend={trendWhenZeroGood(failedJobsThisWeek)}
            footer={
              <span className="block text-[var(--foreground-subtle)]">
                Fallos con inicio en la semana calendario actual (lun–dom, hora local).
              </span>
            }
          />

          <DashboardMetricCard
            title="Proyectos sin dominio"
            icon={Building2}
            iconTone="muted"
            value={projectsWithoutDomain}
            trend={trendWhenZeroGood(projectsWithoutDomain)}
            footer={
              <>
                <span className="block text-[var(--foreground-subtle)]">
                  Sin dominio de gobierno asignado (C4 / whitelist).
                </span>
                <Link to="/projects" className="mt-1 inline-block font-medium text-[var(--primary)] hover:underline">
                  Asignar en proyectos
                </Link>
              </>
            }
          />
        </div>
      </div>

      <DashboardWeeklyBarsCard
        buckets={weekBuckets}
        loading={weekLoading}
        error={weekError}
        hasRepositories={repos.length > 0}
      />
    </div>
  )
}
