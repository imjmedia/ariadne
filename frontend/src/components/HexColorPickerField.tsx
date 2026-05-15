/**
 * Hex color field: dashboard-style trigger + popover with native picker, hex input, and presets.
 */
import { useEffect, useId, useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const FALLBACK_HEX = "#6366f1"

const PRESET_HEX = [
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#22c55e",
  "#0ea5e9",
  "#64748b",
  "#0f172a",
] as const

/** Returns normalized `#rrggbb` or null if invalid. */
export function normalizeHexColor(input: string): string | null {
  let s = input.trim()
  if (!s) return null
  if (!s.startsWith("#")) s = `#${s}`
  if (!/^#[0-9A-Fa-f]{6}$/.test(s)) return null
  return s.toLowerCase()
}

function safeHex(value: string): string {
  return normalizeHexColor(value) ?? FALLBACK_HEX
}

export interface HexColorPickerFieldProps {
  /** Associates with `<Label htmlFor>`. */
  id: string
  value: string
  onChange: (hex: string) => void
  disabled?: boolean
  className?: string
}

export function HexColorPickerField({ id, value, onChange, disabled, className }: HexColorPickerFieldProps) {
  const stable = safeHex(value)
  const [open, setOpen] = useState(false)
  const [hexDraft, setHexDraft] = useState(stable)

  useEffect(() => {
    setHexDraft(safeHex(value))
  }, [value])

  const pickerId = useId()

  function commitHexFromDraft() {
    const n = normalizeHexColor(hexDraft)
    if (n) {
      onChange(n)
      setHexDraft(n)
    } else {
      setHexDraft(safeHex(value))
    }
  }

  function handlePickNative(next: string) {
    const n = normalizeHexColor(next)
    if (n) {
      onChange(n)
      setHexDraft(n)
    }
  }

  function handlePreset(hex: string) {
    onChange(hex)
    setHexDraft(hex)
    setOpen(false)
  }

  return (
    <div className={cn("min-w-0", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={open ? pickerId : undefined}
            className={cn(
              "flex h-11 w-full min-w-0 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-left shadow-sm transition-colors",
              "hover:bg-[color-mix(in_oklch,var(--muted)_45%,transparent)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]",
              disabled && "pointer-events-none opacity-50",
            )}
          >
            <span
              className="size-8 shrink-0 rounded-lg border border-[var(--border)] shadow-[inset_0_1px_0_0_color-mix(in_oklch,var(--foreground)_8%,transparent)]"
              style={{ backgroundColor: stable }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate font-mono text-sm tabular-nums text-[var(--foreground)]">
              {stable}
            </span>
            <ChevronDown className="size-4 shrink-0 text-[var(--foreground-muted)]" strokeWidth={2} aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent id={pickerId} className="w-[min(100vw-2rem,20rem)] p-4" align="start">
          <div className="space-y-4">
            <div className="space-y-2">
              <span className="text-xs font-medium text-[var(--foreground-muted)]">Selector</span>
              <input
                type="color"
                value={stable}
                onChange={(e) => handlePickNative(e.target.value)}
                className={cn(
                  "h-32 w-full cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--muted)]/30",
                  "[color-scheme:light] dark:[color-scheme:dark]",
                  "p-1 shadow-inner",
                )}
                aria-label="Elegir color"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-hex`} className="text-xs font-medium text-[var(--foreground-muted)]">
                Hexadecimal
              </Label>
              <Input
                id={`${id}-hex`}
                value={hexDraft}
                onChange={(e) => setHexDraft(e.target.value)}
                onBlur={() => commitHexFromDraft()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    commitHexFromDraft()
                  }
                }}
                placeholder="#6366f1"
                spellCheck={false}
                className="rounded-xl border-[var(--border)] bg-[var(--card)] font-mono text-sm tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <span className="text-xs font-medium text-[var(--foreground-muted)]">Presets</span>
              <div className="grid grid-cols-5 gap-2">
                {PRESET_HEX.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    title={hex}
                    onClick={() => handlePreset(hex)}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full border-2 border-[var(--border)] shadow-sm transition-transform",
                      "hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2",
                      stable.toLowerCase() === hex && "ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--card)]",
                    )}
                    style={{ backgroundColor: hex }}
                  >
                    <span className="sr-only">{hex}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
