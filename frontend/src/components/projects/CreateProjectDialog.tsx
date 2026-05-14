/**
 * @fileoverview Modal to create a project (name and optional description). POST /projects then navigates to detail.
 */
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/** Single CTA label for header buttons, empty state, and submit. */
export const CREATE_PROJECT_LABEL = "Crear proyecto"

const inputClass = "h-11 rounded-xl border-[var(--border)] bg-[var(--card)]"
const textareaClass =
  "min-h-[6.25rem] rounded-xl border-[var(--border)] bg-[var(--card)] py-2.5 leading-relaxed"

export interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Fires after POST succeeds, before closing the dialog and navigating to the new project. */
  onCreated?: (projectId: string) => void
}

export function CreateProjectDialog({ open, onOpenChange, onCreated }: CreateProjectDialogProps) {
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName("")
    setDescription("")
    setError(null)
  }, [open])

  const handleClose = () => {
    if (loading) return
    onOpenChange(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const project = await api.createProject({
        name: name.trim() || null,
        description: description.trim() || null,
      })
      onCreated?.(project.id)
      onOpenChange(false)
      navigate(`/projects/${project.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear el proyecto")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <DialogContent className="rounded-2xl border-[var(--border)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[var(--foreground)]">{CREATE_PROJECT_LABEL}</DialogTitle>
          <DialogDescription className="text-[var(--foreground-muted)]">
            Define nombre y descripción opcionales. Después podrás vincular repositorios y ver la salud de ingesta en
            el detalle.
          </DialogDescription>
        </DialogHeader>

        <form id="create-project-form" onSubmit={handleSubmit} className="grid gap-5">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="create-project-name" className="text-xs font-medium text-[var(--foreground-muted)]">
              Nombre (opcional)
            </Label>
            <Input
              id="create-project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Mi app front + back"
              className={inputClass}
              disabled={loading}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-project-desc" className="text-xs font-medium text-[var(--foreground-muted)]">
              Descripción (opcional)
            </Label>
            <Textarea
              id="create-project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. Solo ramas main. / Proyecto mixto: front main, back develop."
              rows={4}
              className={textareaClass}
              disabled={loading}
            />
          </div>
        </form>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" className="h-11 rounded-xl border-[var(--border)]" disabled={loading} onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" form="create-project-form" className="h-11 rounded-xl" disabled={loading}>
            {loading ? "Creando…" : CREATE_PROJECT_LABEL}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
