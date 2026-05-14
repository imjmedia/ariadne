/**
 * @fileoverview Confirm delete user (admin).
 */
import { useState } from "react"
import { api } from "@/api"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { UserRow } from "@/components/users/types"

export interface DeleteUserDialogProps {
  user: UserRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: (userId: string) => void
}

export function DeleteUserDialog({ user, open, onOpenChange, onDeleted }: DeleteUserDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOpenChange = (next: boolean) => {
    if (loading) return
    if (!next) setError(null)
    onOpenChange(next)
  }

  const handleDelete = async () => {
    if (!user) return
    setError(null)
    setLoading(true)
    try {
      await api.deleteUser(user.id)
      onDeleted(user.id)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar usuario")
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-2xl border-[var(--border)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[var(--foreground)]">Eliminar usuario</DialogTitle>
          <DialogDescription className="text-[var(--foreground-muted)]">
            Esta acción no se puede deshacer. El usuario{" "}
            <span className="font-medium text-[var(--foreground)]">{user.email}</span> perderá acceso a la aplicación.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl border-[var(--border)]"
            disabled={loading}
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" variant="destructive" className="h-11 rounded-xl" disabled={loading} onClick={() => void handleDelete()}>
            {loading ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
