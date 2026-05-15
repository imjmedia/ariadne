/**
 * @fileoverview One-time MCP token display after create or regenerate — copy + warning.
 */
import { useState } from "react"
import { Check, Copy, Key } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export interface UserMcpTokenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: string | null
  /** Optional context line (e.g. user email). */
  contextLabel?: string | null
}

export function UserMcpTokenDialog({ open, onOpenChange, token, contextLabel }: UserMcpTokenDialogProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!token) return
    void navigator.clipboard.writeText(token)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-[var(--border)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[var(--foreground)]">
            <Key className="size-5 shrink-0 text-[var(--success)]" strokeWidth={1.75} aria-hidden />
            Token MCP
          </DialogTitle>
          <DialogDescription className="text-[var(--foreground-muted)]">
            Este valor se muestra una sola vez. Cópialo y compártelo de forma segura con quien lo vaya a usar.
            {contextLabel ? (
              <>
                {" "}
                <span className="font-medium text-[var(--foreground)]">Usuario:</span> {contextLabel}
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="flex gap-2">
            <Input
              readOnly
              value={token ?? ""}
              className={cn(
                "h-11 flex-1 rounded-xl border-[var(--border)] bg-[var(--muted)]/40 font-mono text-xs text-[var(--foreground)]",
              )}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-xl border-[var(--border)]"
              onClick={handleCopy}
              disabled={!token}
              aria-label="Copiar token"
            >
              {copied ? <Check className="size-4 text-[var(--success)]" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">
            No podrás volver a ver el token completo aquí. Si se pierde, usa «Regenerar token MCP» desde el listado.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" className="h-11 rounded-xl" onClick={() => onOpenChange(false)}>
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
