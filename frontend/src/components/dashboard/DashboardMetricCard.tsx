/**
 * Metric card for the dashboard — title row, icon chip, value + optional trend pill, footer.
 */
import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { Minus, TrendingDown, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

export type DashboardMetricTrendDirection = "up" | "down" | "neutral"

export interface DashboardMetricTrend {
  direction: DashboardMetricTrendDirection
  label: string
}

export interface DashboardMetricCardProps {
  title: string
  icon: LucideIcon
  value: ReactNode
  /** Visual tone for the icon container. */
  iconTone?: "primary" | "success" | "muted"
  trend?: DashboardMetricTrend
  footer: ReactNode
  /** Extra content between the value row and the footer (optional). */
  belowValue?: ReactNode
  className?: string
}

function getTrendPillClass(direction: DashboardMetricTrendDirection): string {
  switch (direction) {
    case "up":
      return "border border-[color-mix(in_oklch,var(--success)_38%,transparent)] bg-[color-mix(in_oklch,var(--success)_16%,transparent)] text-[var(--success)]"
    case "down":
      return "border border-[color-mix(in_oklch,var(--destructive)_30%,transparent)] bg-[color-mix(in_oklch,var(--destructive)_12%,transparent)] text-[var(--destructive)]"
    default:
      return "border border-[var(--border)] bg-[var(--muted)] text-[var(--foreground-muted)]"
  }
}

function TrendGlyph({ direction }: { direction: DashboardMetricTrendDirection }) {
  const common = "size-3.5 shrink-0"
  if (direction === "up") return <TrendingUp className={common} strokeWidth={2.25} aria-hidden />
  if (direction === "down") return <TrendingDown className={common} strokeWidth={2.25} aria-hidden />
  return <Minus className={common} strokeWidth={2.25} aria-hidden />
}

function getIconChipClass(iconTone: NonNullable<DashboardMetricCardProps["iconTone"]>): string {
  switch (iconTone) {
    case "success":
      return "bg-[color-mix(in_oklch,var(--success)_14%,transparent)] text-[var(--success)]"
    case "muted":
      return "bg-[var(--muted)] text-[var(--foreground-subtle)]"
    default:
      return "bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] text-[var(--primary)]"
  }
}

export function DashboardMetricCard({
  title,
  icon: Icon,
  value,
  iconTone = "primary",
  trend,
  footer,
  belowValue,
  className,
}: DashboardMetricCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm",
        "transition-shadow duration-[var(--transition-base)] hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-tight tracking-tight text-[var(--foreground)]">{title}</h3>
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-2xl",
            getIconChipClass(iconTone),
          )}
        >
          <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums tracking-tight text-[var(--foreground)]">{value}</span>
        {trend ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
              getTrendPillClass(trend.direction),
            )}
          >
            <TrendGlyph direction={trend.direction} />
            {trend.label}
          </span>
        ) : null}
      </div>

      {belowValue ? <div className="mt-4">{belowValue}</div> : null}

      <div className="mt-4 text-xs leading-relaxed text-[var(--foreground-muted)]">
        {footer}
      </div>
    </div>
  )
}
