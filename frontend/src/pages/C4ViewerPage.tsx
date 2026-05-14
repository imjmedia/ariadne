/**
 * @fileoverview Visor dedicado C4: selector de proyecto + diagrama + panel DSL (misma API que Arquitectura).
 */
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Info, Package } from "lucide-react"
import { api } from "@/api"
import type { Project } from "@/types"
import { C4Previewer } from "@/components/C4Previewer"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { cn } from "@/lib/utils"

const C4_VIEWER_MODULE_HELP =
  "Mismos endpoints que la pestaña Arquitectura del proyecto: PlantUML vía ingest; el SVG se genera con Kroki a través del proxy del API (sin CORS desde el navegador). Shadow mode (Visual SDD) requiere un sessionId válido cuando el backend lo exige."

const panelClass = cn(
  "rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm",
  "transition-shadow duration-[var(--transition-base)] hover:shadow-md",
)

const selectTriggerClass = cn(
  "h-11 w-full max-w-md min-w-0 justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 shadow-sm",
  "text-left text-sm font-normal text-[var(--foreground)] hover:bg-[var(--card)]",
  "focus-visible:ring-1 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-0",
)

export function C4ViewerPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string>("")
  const [level, setLevel] = useState<1 | 2 | 3>(2)
  const [shadowMode, setShadowMode] = useState(false)
  const [sessionId, setSessionId] = useState("")

  useEffect(() => {
    api
      .getProjects()
      .then((list) => {
        setProjects(list)
        if (list.length > 0) setProjectId((id) => id || list[0].id)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-10">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-4xl font-semibold tracking-tight text-[var(--foreground)]">C4 Viewer</h1>
          <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--foreground-muted)] transition-colors",
                  "hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)] hover:text-[var(--primary)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
                )}
                aria-label="Información: C4 Viewer"
              >
                <Info className="size-5" strokeWidth={1.75} aria-hidden />
              </button>
            </HoverCardTrigger>
            <HoverCardContent
              side="bottom"
              align="start"
              className="w-[min(22rem,calc(100vw-2rem))] max-w-md border-[var(--border)] bg-[var(--card)] p-4 text-sm leading-relaxed text-[var(--foreground)] shadow-md"
            >
              <p className="m-0 text-[var(--foreground-muted)]">{C4_VIEWER_MODULE_HELP}</p>
            </HoverCardContent>
          </HoverCard>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--foreground-muted)]">
          Diagramas C4 por proyecto (niveles 1–3). Elige un proyecto con ingest; opcionalmente activa shadow mode cuando trabajes con Visual SDD.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <section className={panelClass}>
          <div className="space-y-2">
            <Skeleton className="h-7 w-48 rounded-lg" />
            <Skeleton className="h-4 w-full max-w-xl rounded-lg" />
          </div>
          <div className="mt-6">
            <Skeleton className="h-11 w-full max-w-md rounded-xl" />
          </div>
          <Skeleton className="mt-8 h-[min(24rem,50vh)] w-full rounded-2xl" />
        </section>
      ) : projects.length === 0 ? (
        <section className={panelClass}>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Diagrama</h2>
            <p className="mt-1 text-sm text-[var(--foreground-muted)]">Necesitas al menos un proyecto en el tenant.</p>
          </div>
          <div className="mt-8">
            <div
              className={cn(
                "flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)]",
                "bg-[color-mix(in_oklch,var(--muted)_45%,transparent)] px-6 py-14 text-center",
              )}
            >
              <div className="flex size-12 items-center justify-center rounded-2xl bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[var(--primary)]">
                <Package className="size-6" strokeWidth={1.75} aria-hidden />
              </div>
              <p className="mt-4 text-sm font-semibold text-[var(--foreground)]">Aún no hay proyectos</p>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-[var(--foreground-muted)]">
                Crea un proyecto y vincula repositorios con ingest; luego podrás abrir el modelo C4 aquí o desde la pestaña
                Arquitectura del detalle.
              </p>
              <div className="mt-6 flex w-full max-w-sm flex-col gap-2 sm:flex-row sm:justify-center">
                <Button className="h-11 w-full rounded-xl sm:w-auto" asChild>
                  <Link to="/projects/new">Crear proyecto</Link>
                </Button>
                <Button variant="outline" className="h-11 w-full rounded-xl border-[var(--border)] sm:w-auto" asChild>
                  <Link to="/projects">Ver proyectos</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className={cn(panelClass, "overflow-hidden p-0")}>
          <div className="border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_28%,var(--card))] px-6 py-5">
            <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Proyecto</h2>
            <p className="mt-1 text-sm text-[var(--foreground-muted)]">
              Elige el alcance del modelo C4 generado por el ingest.
            </p>
            <div className="mt-4">
              <Label htmlFor="c4-project" className="text-xs font-medium text-[var(--foreground-muted)]">
                Proyecto
              </Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="c4-project" className={cn("mt-2", selectTriggerClass)}>
                  <SelectValue placeholder="Proyecto" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name || p.id.slice(0, 8)} · {p.id.slice(0, 8)}…
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            {projectId ? (
              <C4Previewer
                projectId={projectId}
                level={level}
                onLevelChange={setLevel}
                shadowMode={shadowMode}
                onShadowModeChange={setShadowMode}
                sessionId={sessionId}
                onSessionIdChange={setSessionId}
                layout="split"
              />
            ) : null}
          </div>
        </section>
      )}
    </div>
  )
}
