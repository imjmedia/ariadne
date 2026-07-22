/**
 * @fileoverview Admin modal: view user email, change role, or regenerate MCP token.
 */
import { useEffect, useState } from "react"
import { api } from "@/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { UserRow } from "@/components/users/types"
import { cn } from "@/lib/utils"

const inputClass = "h-11 rounded-xl border-[var(--border)] bg-[var(--muted)]/50 text-[var(--foreground)]"

const selectTriggerMatchInput = cn(
  "h-11 w-full min-w-0 justify-between rounded-xl border border-[var(--border)] bg-[var(--muted)]/50 px-3 shadow-sm",
  "text-left text-sm font-normal text-[var(--foreground)] hover:bg-[color-mix(in_oklch,var(--muted)_65%,var(--card))]",
  "focus-visible:ring-1 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-0",
)

export interface EditUserDialogProps {
  user: UserRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRoleSaved: (userId: string, role: "admin" | "developer") => void
  onShowToken: (payload: { token: string; email: string }) => void
}

export function EditUserDialog({ user, open, onOpenChange, onRoleSaved, onShowToken }: EditUserDialogProps) {
  const [role, setRole] = useState<"admin" | "developer">("developer")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [regenLoading, setRegenLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !open) return
    setRole(user.role)
    setPassword("")
    setError(null)
  }, [user, open])

  const handleClose = () => {
    if (loading || regenLoading) return
    onOpenChange(false)
  }

  const passwordOk = !password || password.length >= 8

  const handleSaveRole = async () => {
    if (!user) return
    if (!passwordOk) {
      setError("Contraseña mínimo 8 caracteres")
      return
    }
    const roleChanged = role !== user.role
    const passwordSet = password.trim().length >= 8
    if (!roleChanged && !passwordSet) {
      onOpenChange(false)
      return
    }
    setError(null)
    setLoading(true)
    try {
      if (roleChanged) {
        await api.updateUserRole(user.id, role)
        onRoleSaved(user.id, role)
      }
      if (passwordSet) {
        await api.setUserPassword(user.id, password.trim())
      }
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar")
    } finally {
      setLoading(false)
    }
  }

  const handleRegenerateToken = async () => {
    if (!user) return
    setError(null)
    setRegenLoading(true)
    try {
      const tokenResult = await api.regenerateMcpToken(user.id)
      onShowToken({ token: tokenResult.token, email: user.email })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al regenerar token")
    } finally {
      setRegenLoading(false)
    }
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={(next) => !loading && !regenLoading && onOpenChange(next)}>
      <DialogContent className="rounded-2xl border-[var(--border)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[var(--foreground)]">Editar usuario</DialogTitle>
          <DialogDescription className="text-[var(--foreground-muted)]">
            Ajusta rol, contraseña o regenera token MCP.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="edit-user-email" className="text-xs font-medium text-[var(--foreground-muted)]">
              Correo
            </Label>
            <Input id="edit-user-email" type="email" readOnly value={user.email} className={inputClass} />
          </div>

          {user.name ? (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-[var(--foreground-muted)]">Nombre</Label>
              <p className="text-sm text-[var(--foreground)]">{user.name}</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="edit-user-role" className="text-xs font-medium text-[var(--foreground-muted)]">
              Rol
            </Label>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "developer")} disabled={loading || regenLoading}>
              <SelectTrigger id="edit-user-role" className={selectTriggerMatchInput}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="developer">Desarrollador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-user-password" className="text-xs font-medium text-[var(--foreground-muted)]">
              Nueva contraseña (opcional, mín. 8)
            </Label>
            <Input
              id="edit-user-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Dejar vacío para no cambiar"
              className={cn(inputClass, "bg-[var(--card)]")}
              disabled={loading || regenLoading}
              aria-invalid={password.length > 0 && !passwordOk}
            />
          </div>

          <div
            className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_42%,var(--card))] p-4 shadow-[inset_0_1px_0_0_color-mix(in_oklch,var(--foreground)_4%,transparent)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--foreground-subtle)]">
              Token MCP
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--foreground-muted)]">
              Estado actual:{" "}
              <span className="font-medium text-[var(--foreground)]">
                {user.hasMcpToken ? "Configurado" : "Sin token"}
              </span>
              . Al regenerar se muestra el nuevo valor una sola vez.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-3 h-10 w-full rounded-xl border-[var(--border)]"
              disabled={loading || regenLoading}
              onClick={() => void handleRegenerateToken()}
            >
              {regenLoading ? "Generando…" : "Regenerar token MCP"}
            </Button>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl border-[var(--border)]"
            disabled={loading || regenLoading}
            onClick={handleClose}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="h-11 rounded-xl"
            disabled={loading || regenLoading || !passwordOk}
            onClick={() => void handleSaveRole()}
          >
            {loading ? "Guardando…" : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
