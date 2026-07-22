/**
 * @fileoverview Admin modal: create user (email + role), then regenerate MCP token and return it to the parent.
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
import { isValidEmailFormat } from "@/utils/emailFormat"
import { cn } from "@/lib/utils"

export const CREATE_USER_LABEL = "Crear usuario"

const inputClass = "h-11 rounded-xl border-[var(--border)] bg-[var(--card)]"

/** Matches `inputClass` visually for SelectTrigger (base Select uses w-fit + tinted bg). */
const selectTriggerMatchInput = cn(
  "h-11 w-full min-w-0 justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 shadow-sm",
  "text-left text-sm font-normal text-[var(--foreground)] hover:bg-[var(--card)]",
  "focus-visible:ring-1 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-0",
)

export interface CreateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUserCreatedWithToken: (payload: { token: string; email: string }) => void
}

export function CreateUserDialog({ open, onOpenChange, onUserCreatedWithToken }: CreateUserDialogProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"admin" | "developer">("developer")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setEmail("")
    setPassword("")
    setRole("developer")
    setError(null)
  }, [open])

  const emailTrimmed = email.trim()
  const emailValid = isValidEmailFormat(emailTrimmed)
  const passwordOk = !password || password.length >= 8

  const handleClose = () => {
    if (loading) return
    onOpenChange(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailValid || !passwordOk) return
    setError(null)
    setLoading(true)
    try {
      const created = (await api.createUser(
        emailTrimmed,
        role,
        password.trim() || undefined,
      )) as { id: string }
      const tokenResult = await api.regenerateMcpToken(created.id)
      onUserCreatedWithToken({ token: tokenResult.token, email: emailTrimmed })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear usuario")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <DialogContent className="rounded-2xl border-[var(--border)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[var(--foreground)]">{CREATE_USER_LABEL}</DialogTitle>
          <DialogDescription className="text-[var(--foreground-muted)]">
            Crea usuario con correo, rol y contraseña opcional (login básico). Tras crear, se genera un token MCP de
            un solo uso.
          </DialogDescription>
        </DialogHeader>

        <form id="create-user-form" onSubmit={handleSubmit} className="grid gap-5">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="create-user-email" className="text-xs font-medium text-[var(--foreground-muted)]">
              Correo
            </Label>
            <Input
              id="create-user-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              className={inputClass}
              disabled={loading}
              aria-invalid={emailTrimmed.length > 0 && !emailValid}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-user-password" className="text-xs font-medium text-[var(--foreground-muted)]">
              Contraseña (opcional, mín. 8)
            </Label>
            <Input
              id="create-user-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
              disabled={loading}
              aria-invalid={password.length > 0 && !passwordOk}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-user-role" className="text-xs font-medium text-[var(--foreground-muted)]">
              Rol
            </Label>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "developer")} disabled={loading}>
              <SelectTrigger id="create-user-role" className={selectTriggerMatchInput}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="developer">Desarrollador</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </form>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl border-[var(--border)]"
            disabled={loading}
            onClick={handleClose}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="create-user-form"
            className="h-11 rounded-xl"
            disabled={loading || !emailValid || !passwordOk}
          >
            {loading ? "Creando…" : CREATE_USER_LABEL}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
