/**
 * @fileoverview Ruta /projects/new: abre el mismo modal de creación que la lista; al cerrar sin crear vuelve a /projects.
 */
import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog"

export function CreateProject() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(true)
  const createdRef = useRef(false)

  useEffect(() => {
    if (open) createdRef.current = false
  }, [open])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next && !createdRef.current) navigate("/projects", { replace: true })
  }

  return (
    <CreateProjectDialog
      open={open}
      onOpenChange={handleOpenChange}
      onCreated={() => {
        createdRef.current = true
      }}
    />
  )
}
