/**
 * @fileoverview Gestión de usuarios (solo admin): KPIs, tabla, crear / editar / eliminar y token MCP.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Code2, Info, Key, Pencil, ShieldCheck, Trash2, Users } from "lucide-react"
import { api } from "@/api"
import { getUser } from "@/utils/auth"
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
import { CreateUserDialog, CREATE_USER_LABEL } from "@/components/users/CreateUserDialog"
import { EditUserDialog } from "@/components/users/EditUserDialog"
import { DeleteUserDialog } from "@/components/users/DeleteUserDialog"
import { UserMcpTokenDialog } from "@/components/users/UserMcpTokenDialog"
import type { UserRow } from "@/components/users/types"

const USERS_MODULE_HELP =
  "Solo administradores acceden a esta vista. Crea usuarios por correo, asigna rol (administrador o desarrollador) y entrega el token MCP de un solo uso. Puedes cambiar roles, regenerar tokens o eliminar cuentas; no puedes eliminarte a ti mismo desde la lista."

const panelClass = cn(
  "rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm",
  "transition-shadow duration-[var(--transition-base)] hover:shadow-md",
)

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
  } catch {
    return "—"
  }
}

function roleLabel(role: "admin" | "developer"): string {
  return role === "admin" ? "Administrador" : "Desarrollador"
}

export function UsersManagement() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null)
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false)
  const [tokenPayload, setTokenPayload] = useState<{ token: string; email: string } | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = (await api.getUsers()) as UserRow[]
      setUsers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar usuarios")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const u = getUser()
    if (!u || u.role !== "admin") {
      navigate("/dashboard", { replace: true })
      return
    }
    setCurrentUserId(u.id)
    void loadUsers()
  }, [navigate, loadUsers])

  const adminCount = useMemo(() => users.filter((u) => u.role === "admin").length, [users])
  const developerCount = useMemo(() => users.filter((u) => u.role === "developer").length, [users])
  const withMcpCount = useMemo(() => users.filter((u) => u.hasMcpToken).length, [users])

  const handleUserCreatedWithToken = (payload: { token: string; email: string }) => {
    setTokenPayload(payload)
    setTokenDialogOpen(true)
    void loadUsers()
  }

  const handleTokenDialogChange = (open: boolean) => {
    setTokenDialogOpen(open)
    if (!open) {
      setTokenPayload(null)
      void loadUsers()
    }
  }

  const handleRoleSaved = (userId: string, role: "admin" | "developer") => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)))
  }

  const handleDeleted = (userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId))
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="text-4xl font-semibold tracking-tight text-[var(--foreground)]">Usuarios</h1>
          <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--foreground-muted)] transition-colors",
                  "hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)] hover:text-[var(--primary)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
                )}
                aria-label="Información: gestión de usuarios"
              >
                <Info className="size-5" strokeWidth={1.75} aria-hidden />
              </button>
            </HoverCardTrigger>
            <HoverCardContent
              side="bottom"
              align="start"
              className="w-[min(22rem,calc(100vw-2rem))] max-w-md border-[var(--border)] bg-[var(--card)] p-4 text-sm leading-relaxed text-[var(--foreground)] shadow-md"
            >
              <p className="m-0 text-[var(--foreground-muted)]">{USERS_MODULE_HELP}</p>
            </HoverCardContent>
          </HoverCard>
        </div>
        <Button type="button" className="rounded-xl touch-manipulation" onClick={() => setCreateOpen(true)}>
          {CREATE_USER_LABEL}
        </Button>
      </div>

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
            title="Usuarios"
            icon={Users}
            value={users.length}
            trend={{ direction: "neutral", label: "Tenant" }}
            footer={<span className="text-[var(--foreground-subtle)]">Cuentas con acceso OTP a la plataforma.</span>}
          />
          <DashboardMetricCard
            title="Administradores"
            icon={ShieldCheck}
            value={adminCount}
            trend={{ direction: "neutral", label: "Rol admin" }}
            footer={
              <span className="text-[var(--foreground-subtle)]">Gestionan usuarios, credenciales y rutas sensibles.</span>
            }
          />
          <DashboardMetricCard
            title="Desarrolladores"
            icon={Code2}
            iconTone="muted"
            value={developerCount}
            trend={{ direction: "neutral", label: "Rol dev" }}
            footer={<span className="text-[var(--foreground-subtle)]">Acceso operativo sin panel de administración.</span>}
          />
          <DashboardMetricCard
            title="Con token MCP"
            icon={Key}
            iconTone={withMcpCount === users.length && users.length > 0 ? "success" : "muted"}
            value={withMcpCount}
            trend={
              withMcpCount === users.length && users.length > 0
                ? { direction: "up", label: "Listo" }
                : { direction: "neutral", label: "MCP" }
            }
            footer={
              <span className="text-[var(--foreground-subtle)]">
                Usuarios con secreto MCP configurado para clientes compatibles.
              </span>
            }
          />
        </div>
      )}

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onUserCreatedWithToken={handleUserCreatedWithToken} />

      <EditUserDialog
        user={editUser}
        open={editUser !== null}
        onOpenChange={(open) => {
          if (!open) setEditUser(null)
        }}
        onRoleSaved={handleRoleSaved}
        onShowToken={(p) => {
          setTokenPayload(p)
          setTokenDialogOpen(true)
          void loadUsers()
        }}
      />

      <DeleteUserDialog
        user={deleteUser}
        open={deleteUser !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteUser(null)
        }}
        onDeleted={handleDeleted}
      />

      <UserMcpTokenDialog
        open={tokenDialogOpen}
        onOpenChange={handleTokenDialogChange}
        token={tokenPayload?.token ?? null}
        contextLabel={tokenPayload?.email ?? null}
      />

      <section className={panelClass}>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[var(--foreground)]">Equipo</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--foreground-muted)]">
            <span className="font-medium text-[var(--foreground)]">Editar</span> abre rol y regeneración de token MCP.{" "}
            <span className="font-medium text-[var(--foreground)]">Eliminar</span> revoca acceso de inmediato.
          </p>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ) : users.length === 0 ? (
            <div
              className={cn(
                "flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)]",
                "bg-[color-mix(in_oklch,var(--muted)_45%,transparent)] px-6 py-14 text-center",
              )}
            >
              <div className="flex size-12 items-center justify-center rounded-2xl bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[var(--primary)]">
                <Users className="size-6" strokeWidth={1.75} aria-hidden />
              </div>
              <p className="mt-4 text-sm font-semibold text-[var(--foreground)]">No hay usuarios además del inicial</p>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-[var(--foreground-muted)]">
                Invita a tu equipo con {CREATE_USER_LABEL.toLowerCase()}. Recuerda copiar el token MCP cuando se genere.
              </p>
              <Button type="button" className="mt-6 rounded-xl" onClick={() => setCreateOpen(true)}>
                {CREATE_USER_LABEL}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
              <Table>
                <TableHeader>
                  <TableRow className="border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_55%,transparent)] hover:bg-[color-mix(in_oklch,var(--muted)_55%,transparent)]">
                    <TableHead className="min-w-[12rem] text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                      Nombre y correo
                    </TableHead>
                    <TableHead className="min-w-[8rem] text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                      Rol
                    </TableHead>
                    <TableHead className="min-w-[8rem] text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                      Token MCP
                    </TableHead>
                    <TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)] sm:table-cell">
                      Alta
                    </TableHead>
                    <TableHead className="w-[140px] text-right text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} className="border-[var(--border)]">
                      <TableCell className="align-middle">
                        {u.name ? (
                          <>
                            <p className="font-medium text-[var(--foreground)]">{u.name}</p>
                            <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">{u.email}</p>
                          </>
                        ) : (
                          <p className="font-medium text-[var(--foreground)]">{u.email}</p>
                        )}
                      </TableCell>
                      <TableCell className="align-middle">
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-lg border font-medium",
                            u.role === "admin"
                              ? "border-[color-mix(in_oklch,var(--primary)_35%,var(--border))] bg-[color-mix(in_oklch,var(--primary)_8%,transparent)] text-[var(--primary)]"
                              : "border-[var(--border)] text-[var(--foreground-muted)]",
                          )}
                        >
                          {roleLabel(u.role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-middle">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                            u.hasMcpToken
                              ? "bg-[color-mix(in_oklch,var(--success)_14%,transparent)] text-[var(--success)]"
                              : "bg-[var(--muted)] text-[var(--foreground-muted)]",
                          )}
                        >
                          {u.hasMcpToken ? "Configurado" : "Pendiente"}
                        </span>
                      </TableCell>
                      <TableCell className="hidden align-middle text-sm text-[var(--foreground-muted)] sm:table-cell">
                        {formatShortDate(u.createdAt)}
                      </TableCell>
                      <TableCell className="text-right align-middle">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="rounded-xl touch-manipulation"
                            onClick={() => setEditUser(u)}
                          >
                            <Pencil className="size-3.5 sm:mr-1" strokeWidth={2} aria-hidden />
                            <span className="hidden sm:inline">Editar</span>
                          </Button>
                          {u.id !== currentUserId ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-xl border-[var(--border)] text-[var(--destructive)] touch-manipulation hover:bg-[color-mix(in_oklch,var(--destructive)_8%,transparent)]"
                              onClick={() => setDeleteUser(u)}
                              aria-label={`Eliminar ${u.email}`}
                            >
                              <Trash2 className="size-3.5" strokeWidth={2} aria-hidden />
                            </Button>
                          ) : null}
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
    </div>
  )
}
