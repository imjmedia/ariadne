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

const panelClass = cn(
  "rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm",
  "transition-shadow duration-[var(--transition-base)] hover:shadow-md",
)

/**
 * Trims and removes a leading `http://` or `https://` when the user pastes a full URL into the host field.
 */
function stripLeadingUrlProtocol(value: string): string {
  const t = value.trimStart()
  const head = t.slice(0, 8).toLowerCase()
  if (head.startsWith("https://")) return t.slice(8)
  const head7 = t.slice(0, 7).toLowerCase()
  if (head7 === "http://") return t.slice(7)
  return value
}

/**
 * Final value sent to the API: trim, strip optional scheme, drop trailing slashes.
 */
function sanitizeDomainNameForApi(raw: string): string {
  let v = stripLeadingUrlProtocol(raw).trim()
  v = v.replace(/\/+$/, "")
  return v.trim()
}

export function DomainsList() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
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

  const handleDomainNameInputChange = (value: string) => {
    setName(stripLeadingUrlProtocol(value))
  }

  const create = async () => {
    const trimmedName = sanitizeDomainNameForApi(name)
    if (!trimmedName) return
    setSaving(true)
    setError(null)
    try {
      await api.createDomain({ name: trimmedName, color, description: desc.trim() || null })
      setName("")
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
            Nombre en estilo host o legible, color hexadecimal para badges en la UI.
          </p>
        </div>
        <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:items-stretch">
          <div className="flex min-w-0 flex-col gap-5 lg:col-span-8">
            <div className="space-y-2">
              <Label htmlFor="dn" className="text-xs font-medium text-[var(--foreground-muted)]">
                Nombre del dominio
              </Label>
              <div
                className={cn(
                  "flex min-h-11 w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm transition-colors",
                  "focus-within:ring-1 focus-within:ring-[var(--ring)]",
                )}
              >
                <span
                  className="flex shrink-0 select-none items-center border-r border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_48%,var(--card))] px-3 font-mono text-xs text-[var(--foreground-muted)]"
                  aria-hidden
                >
                  https://
                </span>
                <input
                  id="dn"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={name}
                  onChange={(e) => handleDomainNameInputChange(e.target.value)}
                  placeholder="pagos.tu-org.internal"
                  className="min-h-11 flex-1 border-0 bg-transparent px-3 py-2 font-mono text-sm text-[var(--foreground)] outline-none placeholder:text-muted-foreground"
                />
              </div>
              <p className="text-[11px] leading-snug text-[var(--foreground-muted)]">
                Estilo host o ruta virtual; si pegas una URL completa, quitamos el prefijo automáticamente.
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
              disabled={saving || !sanitizeDomainNameForApi(name)}
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
