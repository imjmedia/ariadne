/**
 * @fileoverview CRUD de dominios de arquitectura (color, metadata, recuento de proyectos, visibilidad entre dominios).
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { FolderInput, Info, Layers, Unlink } from "lucide-react"
import { api } from "@/api"
import type { Domain, DomainVisibilityEdge } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { HexColorPickerField } from "@/components/HexColorPickerField"
import { DashboardMetricCard } from "@/components/dashboard/DashboardMetricCard"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"

const DOMAINS_MODULE_HELP =
  "Gobierno de arquitectura: agrupa proyectos, define visibilidad dirigida entre dominios para shards Falkor, y la whitelist proyecto→dominio en la pestaña Arquitectura del proyecto."

/** Bounded contexts habituales para gobierno de dominios (no son URLs ni hosts). */
const ARCHITECTURE_DOMAIN_PRESETS = [
  {
    id: "plataforma",
    name: "Plataforma",
    description: "Capacidades transversales, configuración y servicios compartidos del ecosistema.",
    color: "#6366f1",
  },
  {
    id: "identidad",
    name: "Identidad y acceso",
    description: "Autenticación, autorización, usuarios, roles y permisos.",
    color: "#8b5cf6",
  },
  {
    id: "pagos",
    name: "Pagos",
    description: "Cobros, reembolsos, conciliación y pasarelas de pago.",
    color: "#10b981",
  },
  {
    id: "catalogo",
    name: "Catálogo",
    description: "Productos, servicios, precios y disponibilidad.",
    color: "#f59e0b",
  },
  {
    id: "ordenes",
    name: "Órdenes",
    description: "Pedidos, flujos de compra y ciclo de vida de transacciones.",
    color: "#ef4444",
  },
  {
    id: "crm",
    name: "CRM",
    description: "Gestión de clientes, oportunidades, pipeline comercial y relaciones.",
    color: "#ec4899",
  },
  {
    id: "notificaciones",
    name: "Notificaciones",
    description: "Email, SMS, push y mensajería transaccional.",
    color: "#06b6d4",
  },
  {
    id: "reporting",
    name: "Reporting y analítica",
    description: "KPIs, dashboards, exportaciones y métricas de negocio.",
    color: "#64748b",
  },
  {
    id: "integraciones",
    name: "Integraciones",
    description: "APIs externas, ETL, buses de eventos y conectores.",
    color: "#a855f7",
  },
  {
    id: "infraestructura",
    name: "Infraestructura",
    description: "Despliegue, observabilidad, CI/CD y plataforma técnica.",
    color: "#475569",
  },
] as const

/** Opción del select para motores o microservicios con nombre propio del tenant. */
const CUSTOM_DOMAIN_OPTION_ID = "__custom__"

const panelClass = cn(
  "rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm",
  "transition-shadow duration-[var(--transition-base)] hover:shadow-md",
)

function normalizeDomainName(value: string): string {
  return value.trim().toLocaleLowerCase()
}

export function DomainsList() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPresetId, setSelectedPresetId] = useState("")
  const [customName, setCustomName] = useState("")
  const [color, setColor] = useState("#6366f1")
  const [desc, setDesc] = useState("")
  const [saving, setSaving] = useState(false)

  const [projectsDialogDomain, setProjectsDialogDomain] = useState<Domain | null>(null)
  const [projectsInDomain, setProjectsInDomain] = useState<Array<{ id: string; name: string | null }>>([])
  const [loadingProjects, setLoadingProjects] = useState(false)

  const [visDialogDomain, setVisDialogDomain] = useState<Domain | null>(null)
  const [visEdges, setVisEdges] = useState<DomainVisibilityEdge[]>([])
  const [loadingVis, setLoadingVis] = useState(false)
  const [addVisTargetId, setAddVisTargetId] = useState("")
  const [addVisDesc, setAddVisDesc] = useState("")
  const [addingVis, setAddingVis] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    api
      .getDomains()
      .then(setDomains)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const domainsWithProjects = useMemo(
    () => domains.filter((d) => (d.assignedProjectCount ?? 0) > 0).length,
    [domains],
  )
  const domainsWithoutProjects = useMemo(
    () => domains.filter((d) => (d.assignedProjectCount ?? 0) === 0).length,
    [domains],
  )

  const existingDomainNames = useMemo(
    () => new Set(domains.map((d) => normalizeDomainName(d.name))),
    [domains],
  )

  const availablePresets = useMemo(
    () => ARCHITECTURE_DOMAIN_PRESETS.filter((preset) => !existingDomainNames.has(normalizeDomainName(preset.name))),
    [existingDomainNames],
  )

  const selectedPreset = useMemo(
    () => ARCHITECTURE_DOMAIN_PRESETS.find((preset) => preset.id === selectedPresetId) ?? null,
    [selectedPresetId],
  )

  const isCustomSelection = selectedPresetId === CUSTOM_DOMAIN_OPTION_ID

  const resolvedDomainName = useMemo(() => {
    if (isCustomSelection) return customName.trim()
    return selectedPreset?.name ?? ""
  }, [customName, isCustomSelection, selectedPreset])

  const canCreateDomain = useMemo(() => {
    if (!resolvedDomainName) return false
    return !existingDomainNames.has(normalizeDomainName(resolvedDomainName))
  }, [existingDomainNames, resolvedDomainName])

  useEffect(() => {
    if (
      selectedPresetId &&
      selectedPresetId !== CUSTOM_DOMAIN_OPTION_ID &&
      !availablePresets.some((preset) => preset.id === selectedPresetId)
    ) {
      setSelectedPresetId("")
    }
  }, [availablePresets, selectedPresetId])

  const openProjectsDialog = (d: Domain) => {
    setProjectsDialogDomain(d)
    setLoadingProjects(true)
    setProjectsInDomain([])
    api
      .getDomainProjects(d.id)
      .then(setProjectsInDomain)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingProjects(false))
  }

  const openVisDialog = (d: Domain) => {
    setVisDialogDomain(d)
    setAddVisTargetId("")
    setAddVisDesc("")
    setLoadingVis(true)
    setVisEdges([])
    api
      .listDomainVisibility(d.id)
      .then(setVisEdges)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingVis(false))
  }

  const refreshVis = (fromId: string) => {
    api.listDomainVisibility(fromId).then(setVisEdges).catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }

  const addVisibilityEdge = async () => {
    if (!visDialogDomain || !addVisTargetId) return
    setAddingVis(true)
    setError(null)
    try {
      await api.addDomainVisibility(visDialogDomain.id, {
        toDomainId: addVisTargetId,
        description: addVisDesc.trim() || null,
      })
      setAddVisTargetId("")
      setAddVisDesc("")
      await refreshVis(visDialogDomain.id)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAddingVis(false)
    }
  }

  const removeVisibilityEdge = async (edgeId: string) => {
    if (!visDialogDomain) return
    try {
      await api.removeDomainVisibility(visDialogDomain.id, edgeId)
      await refreshVis(visDialogDomain.id)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId)
    if (presetId === CUSTOM_DOMAIN_OPTION_ID) {
      setCustomName("")
      setColor("#6366f1")
      setDesc("")
      return
    }
    const preset = ARCHITECTURE_DOMAIN_PRESETS.find((item) => item.id === presetId)
    if (!preset) return
    setCustomName("")
    setColor(preset.color)
    setDesc(preset.description)
  }

  const create = async () => {
    if (!canCreateDomain) return
    setSaving(true)
    setError(null)
    try {
      await api.createDomain({
        name: resolvedDomainName,
        color,
        description: desc.trim() || (selectedPreset?.description ?? null),
      })
      setSelectedPresetId("")
      setCustomName("")
      setColor("#6366f1")
      setDesc("")
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm("¿Eliminar este dominio? Los proyectos quedarán sin dominio (SET NULL).")) return
    try {
      await api.deleteDomain(id)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const visTargetChoices = visDialogDomain ? domains.filter((x) => x.id !== visDialogDomain.id) : []

  const inputClass = "h-11 rounded-xl border-[var(--border)] bg-[var(--card)]"
  const textareaClass =
    "min-h-[6.25rem] rounded-xl border-[var(--border)] bg-[var(--card)] py-2.5 leading-relaxed"

  return (
    <div className="space-y-10">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-4xl font-semibold tracking-tight text-[var(--foreground)]">Dominios</h1>
          <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--foreground-muted)] transition-colors",
                  "hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)] hover:text-[var(--primary)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
                )}
                aria-label="Información: para qué sirve el módulo Dominios"
              >
                <Info className="size-5" strokeWidth={1.75} aria-hidden />
              </button>
            </HoverCardTrigger>
            <HoverCardContent
              side="bottom"
              align="start"
              className={cn(
                "w-[min(22rem,calc(100vw-2rem))] max-w-md border-[var(--border)] bg-[var(--card)] p-4 text-sm leading-relaxed text-[var(--foreground)] shadow-md",
              )}
            >
              <p className="m-0 text-[var(--foreground-muted)]">{DOMAINS_MODULE_HELP}</p>
            </HoverCardContent>
          </HoverCard>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardMetricCard
            title="Dominios registrados"
            icon={Layers}
            value={domains.length}
            trend={{ direction: "neutral", label: "Catálogo" }}
            footer={<span className="text-[var(--foreground-subtle)]">Bounded contexts definidos en el tenant.</span>}
          />
          <DashboardMetricCard
            title="Con proyectos"
            icon={FolderInput}
            value={domainsWithProjects}
            trend={
              domainsWithProjects > 0
                ? { direction: "up", label: "En uso" }
                : { direction: "neutral", label: "Sin asignar" }
            }
            footer={
              <span className="text-[var(--foreground-subtle)]">
                Dominios con al menos un proyecto en <span className="font-mono text-xs">projects.domain_id</span>.
              </span>
            }
          />
          <DashboardMetricCard
            title="Sin proyectos"
            icon={Unlink}
            iconTone="muted"
            value={domainsWithoutProjects}
            trend={
              domainsWithoutProjects === 0
                ? { direction: "up", label: "Completo" }
                : { direction: "neutral", label: "Revisar" }
            }
            footer={
              <span className="text-[var(--foreground-subtle)]">
                Aún no vinculados a un proyecto; revisa gobierno de dominios.
              </span>
            }
          />
        </div>
      )}

      <section className={panelClass}>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[var(--foreground)]">Crear dominio</h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--foreground-muted)]">
            Elige un bounded context de arquitectura (no es un dominio web). Para motores o microservicios propios del
            tenant, usa <span className="font-medium text-[var(--foreground)]">Personalizado</span>.
          </p>
        </div>
        <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:items-stretch">
          <div className="flex min-w-0 flex-col gap-5 lg:col-span-8">
            <div className="space-y-2">
              <Label htmlFor="dn" className="text-xs font-medium text-[var(--foreground-muted)]">
                Dominio de arquitectura
              </Label>
              <Select value={selectedPresetId || undefined} onValueChange={handlePresetChange} disabled={saving}>
                <SelectTrigger id="dn" className={cn(inputClass, "w-full")}>
                  <SelectValue placeholder="Elegir bounded context" />
                </SelectTrigger>
                <SelectContent>
                  {availablePresets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block size-3 shrink-0 rounded-full border border-[var(--border)]"
                          style={{ backgroundColor: preset.color }}
                          aria-hidden
                        />
                        {preset.name}
                      </span>
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_DOMAIN_OPTION_ID}>Personalizado (motor / microservicio)</SelectItem>
                </SelectContent>
              </Select>
              {isCustomSelection ? (
                <div className="space-y-2">
                  <Label htmlFor="dcn" className="text-xs font-medium text-[var(--foreground-muted)]">
                    Nombre del motor o microservicio
                  </Label>
                  <Input
                    id="dcn"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Ej. Motor de costos, Listas de precios, Media Manager"
                    className={inputClass}
                    disabled={saving}
                  />
                </div>
              ) : null}
              <p className="text-[11px] leading-snug text-[var(--foreground-muted)]">
                Los presets cubren contextos de negocio amplios. Motores dedicados (costos, precios, media, etc.) créalos
                con <span className="font-medium text-[var(--foreground)]">Personalizado</span> usando el nombre que ya
                usa tu equipo — no hace falta URL ni prefijo técnico.
              </p>
            </div>
            <div className="min-h-0 flex-1 space-y-2">
              <Label htmlFor="dd" className="text-xs font-medium text-[var(--foreground-muted)]">
                Descripción
              </Label>
              <Textarea
                id="dd"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Opcional — alcance del dominio para tu equipo (varias líneas)."
                rows={4}
                className={textareaClass}
              />
            </div>
          </div>

          <aside
            className={cn(
              "flex min-h-0 min-w-0 flex-col justify-between gap-6 rounded-2xl border border-[var(--border)] p-5 lg:col-span-4",
              "bg-[color-mix(in_oklch,var(--muted)_42%,var(--card))] shadow-[inset_0_1px_0_0_color-mix(in_oklch,var(--foreground)_4%,transparent)]",
            )}
          >
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--foreground-subtle)]">
                Color en UI
              </p>
              <Label htmlFor="dc" className="text-xs font-medium text-[var(--foreground-muted)]">
                Marca visual
              </Label>
              <p className="text-[11px] leading-snug text-[var(--foreground-muted)]">
                Hex para badges y UI. Abre el panel para ajustar o elegir un preset.
              </p>
              <HexColorPickerField id="dc" value={color} onChange={setColor} disabled={saving} className="pt-1" />
            </div>
            <Button
              type="button"
              className="h-11 w-full shrink-0 rounded-xl"
              onClick={() => void create()}
              disabled={saving || !canCreateDomain}
            >
              {saving ? "Guardando…" : "Crear dominio"}
            </Button>
          </aside>
        </div>
      </section>

      <section className={panelClass}>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[var(--foreground)]">Catálogo</h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--foreground-muted)]">
            <span className="font-medium text-[var(--foreground)]">Proyectos asignados</span> cuenta filas con{" "}
            <code className="rounded bg-[var(--muted)] px-1 py-0.5 font-mono text-[11px] text-[var(--foreground)]">
              projects.domain_id
            </code>
            . <span className="font-medium text-[var(--foreground)]">Visibilidad</span> edita{" "}
            <code className="rounded bg-[var(--muted)] px-1 py-0.5 font-mono text-[11px] text-[var(--foreground)]">
              domain_domain_visibility
            </code>{" "}
            (aristas salientes desde este dominio).
          </p>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ) : domains.length === 0 ? (
            <div
              className={cn(
                "flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)]",
                "bg-[color-mix(in_oklch,var(--muted)_45%,transparent)] px-6 py-14 text-center",
              )}
            >
              <div className="flex size-12 items-center justify-center rounded-2xl bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[var(--primary)]">
                <Layers className="size-6" strokeWidth={1.75} aria-hidden />
              </div>
              <p className="mt-4 text-sm font-semibold text-[var(--foreground)]">No hay dominios todavía</p>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-[var(--foreground-muted)]">
                Crea el primero con el formulario anterior. Los dominios permiten agrupar proyectos y configurar
                visibilidad entre dominios (shards extendidos).
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
              <Table>
                <TableHeader>
                  <TableRow className="border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_55%,transparent)] hover:bg-[color-mix(in_oklch,var(--muted)_55%,transparent)]">
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                      Nombre
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                      Color
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                      Descripción
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                      Proyectos
                    </TableHead>
                    <TableHead className="w-[220px] text-right text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domains.map((d) => (
                    <TableRow key={d.id} className="border-[var(--border)]">
                      <TableCell className="font-medium text-[var(--foreground)]">{d.name}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="inline-block size-6 shrink-0 rounded-full border border-[var(--border)] shadow-sm"
                            style={{ backgroundColor: d.color }}
                          />
                          <code className="rounded-md bg-[var(--muted)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--foreground-muted)]">
                            {d.color}
                          </code>
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[min(28rem,40vw)] truncate text-sm text-[var(--foreground-muted)]">
                        {d.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => openProjectsDialog(d)}
                        >
                          {d.assignedProjectCount ?? 0}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-xl border-[var(--border)]"
                            onClick={() => openVisDialog(d)}
                          >
                            Visibilidad
                          </Button>
                          <Button type="button" variant="destructive" size="sm" className="rounded-xl" onClick={() => void remove(d.id)}>
                            Eliminar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </section>

      <Dialog open={projectsDialogDomain !== null} onOpenChange={(o) => !o && setProjectsDialogDomain(null)}>
        <DialogContent className="rounded-2xl border-[var(--border)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--foreground)]">Proyectos en «{projectsDialogDomain?.name}»</DialogTitle>
            <DialogDescription className="text-[var(--foreground-muted)]">
              Proyectos con{" "}
              <code className="rounded bg-[var(--muted)] px-1 font-mono text-xs">domain_id</code> apuntando a este
              dominio.
            </DialogDescription>
          </DialogHeader>
          {loadingProjects ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          ) : projectsInDomain.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--foreground-muted)]">Ningún proyecto asignado.</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_30%,transparent)] p-3">
              {projectsInDomain.map((p) => (
                <li key={p.id} className="rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--muted)]">
                  <Link to={`/projects/${p.id}`} className="text-sm font-medium text-[var(--primary)] hover:underline">
                    {p.name?.trim() || p.id.slice(0, 8)}
                  </Link>
                  <code className="ml-2 font-mono text-[11px] text-[var(--foreground-muted)]">{p.id}</code>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      <Dialog open={visDialogDomain !== null} onOpenChange={(o) => !o && setVisDialogDomain(null)}>
        <DialogContent className="rounded-2xl border-[var(--border)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[var(--foreground)]">Visibilidad desde «{visDialogDomain?.name}»</DialogTitle>
            <DialogDescription className="text-[var(--foreground-muted)]">
              Aristas{" "}
              <code className="rounded bg-[var(--muted)] px-1 font-mono text-xs">domain_domain_visibility</code>: otros
              dominios cuyos proyectos se incluyen en el contexto de grafos. Dirección: desde este dominio →
              destino.
            </DialogDescription>
          </DialogHeader>
          {loadingVis ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          ) : (
            <div className="space-y-4">
              {visEdges.length > 0 ? (
                <ul className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-[var(--border)] p-3">
                  {visEdges.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-transparent px-2 py-1.5 text-sm hover:border-[var(--border)] hover:bg-[color-mix(in_oklch,var(--muted)_40%,transparent)]"
                    >
                      <span className="min-w-0 text-[var(--foreground)]">
                        → <strong>{e.toDomainName ?? e.toDomainId}</strong>
                        {e.description ? (
                          <span className="text-[var(--foreground-muted)]"> ({e.description})</span>
                        ) : null}
                      </span>
                      <Button type="button" variant="ghost" size="sm" className="shrink-0 rounded-lg" onClick={() => void removeVisibilityEdge(e.id)}>
                        Quitar
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl border border-dashed border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_35%,transparent)] px-4 py-6 text-center text-sm text-[var(--foreground-muted)]">
                  Sin aristas salientes.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2 sm:items-end lg:grid-cols-12">
                <div className="space-y-2 sm:col-span-2 lg:col-span-5">
                  <Label className="text-xs font-medium text-[var(--foreground-muted)]">Destino</Label>
                  <Select value={addVisTargetId || undefined} onValueChange={setAddVisTargetId}>
                    <SelectTrigger className="rounded-xl border-[var(--border)]">
                      <SelectValue placeholder="Dominio destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {visTargetChoices.map((x) => (
                        <SelectItem key={x.id} value={x.id}>
                          {x.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2 lg:col-span-5">
                  <Label className="text-xs font-medium text-[var(--foreground-muted)]">Nota</Label>
                  <Input
                    value={addVisDesc}
                    onChange={(e) => setAddVisDesc(e.target.value)}
                    placeholder="Opcional"
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-2 lg:flex lg:justify-end">
                  <Button
                    type="button"
                    className="w-full rounded-xl lg:w-auto"
                    disabled={!addVisTargetId || addingVis}
                    onClick={() => void addVisibilityEdge()}
                  >
                    {addingVis ? "Añadiendo…" : "Añadir"}
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  )
}
