/**
 * Weekly sync activity — counts jobs by weekday (current Mon–Sun, local) from ingest `getJobs` data.
 */
import { useEffect, useMemo, useState } from "react"
import { MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import type { WeekDayActivityBucket } from "@/lib/weeklySyncActivity"
import { barHeightPercent } from "@/lib/weeklySyncActivity"

export interface DashboardWeeklyBarsCardProps {
  buckets: WeekDayActivityBucket[]
  loading?: boolean
  error?: string | null
  hasRepositories: boolean
  className?: string
}

export function DashboardWeeklyBarsCard({
  buckets,
  loading = false,
  error = null,
  hasRepositories,
  className,
}: DashboardWeeklyBarsCardProps) {
  const [selectedWeekdayIndex, setSelectedWeekdayIndex] = useState<number | null>(null)

  const bucketsSignature = useMemo(() => buckets.map((b) => `${b.weekdayIndex}:${b.count}`).join("|"), [buckets])

  useEffect(() => {
    setSelectedWeekdayIndex(null)
  }, [bucketsSignature])

  const totalCount = useMemo(() => buckets.reduce((sum, b) => sum + b.count, 0), [buckets])
  const maxCount = useMemo(() => buckets.reduce((m, b) => Math.max(m, b.count), 0), [buckets])
  const hasAnyActivity = totalCount > 0

  const highlightedIndex = useMemo(() => {
    if (!hasAnyActivity) return -1
    if (selectedWeekdayIndex !== null) return selectedWeekdayIndex
    const today = buckets.findIndex((b) => b.isToday)
    return today >= 0 ? today : 0
  }, [buckets, hasAnyActivity, selectedWeekdayIndex])

  const subtitle = (() => {
    if (loading) return "Cargando historial de sincronización…"
    if (error) return "No se pudo cargar el historial. Reintenta más tarde."
    if (!hasRepositories)
      return "Añade repositorios para acumular actividad de sync en esta vista."
    if (!hasAnyActivity) return "Sin jobs de sync en la semana actual (lunes a domingo)."
    return "Jobs de sync iniciados por día (zona horaria local). Hasta 100 jobs recientes por repositorio."
  })()

  function handleSelectDay(weekdayIndex: number) {
    setSelectedWeekdayIndex((prev) => (prev === weekdayIndex ? null : weekdayIndex))
  }

  return (
    <section
      className={cn(
        "flex flex-col rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm",
        "transition-shadow duration-[var(--transition-base)] hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-[var(--foreground)]">Actividad reciente</h3>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">{subtitle}</p>
          {error && !loading ? (
            <p className="mt-2 text-xs font-medium text-[var(--destructive)]" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="flex size-9 shrink-0 items-center justify-center rounded-xl text-[var(--foreground-muted)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          aria-label="Más opciones"
        >
          <MoreHorizontal className="size-5" strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      <div
        className="mt-8 flex min-h-[140px] items-end justify-between gap-1.5 sm:gap-2"
        role="img"
        aria-label={`Actividad de sync de la semana. Total ${totalCount} jobs.`}
      >
        {loading
          ? buckets.map((b) => (
              <div key={b.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex h-7 w-full max-w-[2.25rem] items-center justify-center sm:h-8">
                  <span className="text-[11px] text-transparent" aria-hidden>
                    0
                  </span>
                </div>
                <div className="flex h-28 w-full max-w-[2.25rem] items-end justify-center sm:h-32">
                  <div
                    className="w-full max-w-8 animate-pulse rounded-full bg-[var(--muted)]"
                    style={{ height: "28%" }}
                  />
                </div>
                <span className="text-[11px] font-medium text-[var(--foreground-muted)] sm:text-xs">{b.label}</span>
              </div>
            ))
          : buckets.map((bar, index) => {
              const isHighlighted = index === highlightedIndex
              const heightPct = barHeightPercent(bar.count, maxCount, hasAnyActivity)
              const showCountAbove = bar.count > 0

              return (
                <div key={bar.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <div className="flex h-7 w-full max-w-[2.25rem] items-center justify-center sm:h-8">
                    {showCountAbove ? (
                      <span
                        className={cn(
                          "text-[11px] font-semibold tabular-nums",
                          isHighlighted ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)]",
                        )}
                      >
                        {bar.count}
                      </span>
                    ) : (
                      <span className="text-[11px] text-transparent" aria-hidden>
                        0
                      </span>
                    )}
                  </div>
                  <div className="flex h-28 w-full max-w-[2.25rem] items-end justify-center sm:h-32">
                    {hasAnyActivity ? (
                      <button
                        type="button"
                        title={`${bar.label}: ${bar.count} job${bar.count === 1 ? "" : "s"}`}
                        aria-label={`${bar.label}, ${bar.count} jobs de sync`}
                        aria-pressed={isHighlighted}
                        onClick={() => handleSelectDay(bar.weekdayIndex)}
                        className={cn(
                          "flex h-full w-full max-w-8 min-w-0 items-end justify-center rounded-full transition-colors duration-200",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]",
                        )}
                      >
                        <span
                          className={cn(
                            "block w-full max-w-8 rounded-full transition-colors duration-200",
                            isHighlighted
                              ? "bg-[var(--primary)]"
                              : "bg-[color-mix(in_oklch,var(--muted-foreground)_12%,var(--muted))]",
                          )}
                          style={{ height: `${heightPct}%` }}
                        />
                      </button>
                    ) : (
                      <div
                        className="flex h-full w-full max-w-8 items-end justify-center"
                        title={`${bar.label}: ${bar.count} jobs`}
                      >
                        <span
                          className="block w-full max-w-8 rounded-full bg-[color-mix(in_oklch,var(--muted-foreground)_12%,var(--muted))] transition-colors duration-200"
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-[11px] font-medium sm:text-xs",
                      isHighlighted && hasAnyActivity
                        ? "text-[var(--primary)]"
                        : "text-[var(--foreground-muted)]",
                    )}
                  >
                    {bar.label}
                  </span>
                </div>
              )
            })}
      </div>
    </section>
  )
}
