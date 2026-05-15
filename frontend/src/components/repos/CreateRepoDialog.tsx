/**
 * @fileoverview Modal to create a repository (same flow as the former /repos/new page).
 */
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import type { Repository } from "@/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CreateRepoForm } from "@/components/repos/CreateRepoForm"

/** Single CTA label for header and empty state (opens this dialog). */
export const NEW_REPOSITORY_LABEL = "Nuevo repositorio"

export interface CreateRepoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Optional refresh before navigation (e.g. invalidate list cache). */
  onCreated?: () => void
  /** When set, repository is created under this project (multi-root); success navigates to project detail. */
  defaultProjectId?: string | null
}

export function CreateRepoDialog({
  open,
  onOpenChange,
  onCreated,
  defaultProjectId = null,
}: CreateRepoDialogProps) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const handleOpenChange = (next: boolean) => {
    if (busy) return
    onOpenChange(next)
  }

  const handleSuccess = (repo: Repository) => {
    onCreated?.()
    onOpenChange(false)
    if (defaultProjectId) navigate(`/projects/${defaultProjectId}`)
    else navigate(`/repos/${repo.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-h-[min(90vh,40rem)] flex-col gap-0 overflow-hidden rounded-2xl border-[var(--border)] p-0 sm:max-w-lg"
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault()
        }}
      >
        <DialogHeader className="shrink-0 space-y-2 border-b border-[var(--border)] px-6 py-5 text-left">
          <DialogTitle className="text-[var(--foreground)]">{NEW_REPOSITORY_LABEL}</DialogTitle>
          <DialogDescription className="text-[var(--foreground-muted)]">
            Elige proveedor y credencial, luego workspace u owner, repositorio y rama por defecto.
            {defaultProjectId ? " El repositorio quedará vinculado al proyecto actual." : null}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {open ? (
            <CreateRepoForm
              key={defaultProjectId ?? "_none"}
              variant="dialog"
              projectIdFromUrl={defaultProjectId}
              onSuccess={handleSuccess}
              onCancel={() => handleOpenChange(false)}
              onBusyChange={setBusy}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
