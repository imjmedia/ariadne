/**
 * Buckets sync jobs by weekday for the current calendar week (Mon 00:00 – Sun end, local time).
 */

export const WEEKDAY_SHORT_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const

export interface WeekDayActivityBucket {
  weekdayIndex: number
  label: (typeof WEEKDAY_SHORT_ES)[number]
  count: number
  isToday: boolean
}

/** Monday = 0 … Sunday = 6 (local). */
export function getMondayBasedWeekday(d: Date): number {
  return (d.getDay() + 6) % 7
}

/** Start of ISO week (Monday 00:00:00.000) in local timezone. */
export function startOfIsoWeekMonday(reference: Date): Date {
  const d = new Date(reference)
  d.setHours(0, 0, 0, 0)
  const mondayOffset = getMondayBasedWeekday(d)
  d.setDate(d.getDate() - mondayOffset)
  return d
}

/**
 * Counts jobs whose `startedAt` falls within the current Mon–Sun window.
 */
export function buildCurrentWeekSyncBuckets(
  jobs: Array<{ startedAt: string }>,
  now: Date = new Date(),
): WeekDayActivityBucket[] {
  const weekStart = startOfIsoWeekMonday(now)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const counts = [0, 0, 0, 0, 0, 0, 0]
  for (const job of jobs) {
    const t = new Date(job.startedAt)
    if (Number.isNaN(t.getTime()) || t < weekStart || t >= weekEnd) continue
    const idx = getMondayBasedWeekday(t)
    counts[idx] += 1
  }

  const todayIdx = getMondayBasedWeekday(now)

  return WEEKDAY_SHORT_ES.map((label, weekdayIndex) => ({
    weekdayIndex,
    label,
    count: counts[weekdayIndex],
    isToday: weekdayIndex === todayIdx,
  }))
}

/**
 * Bar height as percentage of track (14–100). Uniform floor when there is no activity in the week.
 */
export function barHeightPercent(count: number, maxCount: number, hasAnyActivity: boolean): number {
  if (!hasAnyActivity) return 18
  if (count <= 0) return 14
  const max = Math.max(maxCount, 1)
  return Math.min(100, Math.max(24, Math.round((count / max) * 100)))
}

/**
 * Counts failed sync jobs whose `startedAt` falls in the current Mon–Sun window (local).
 */
export function countFailedSyncJobsInCurrentWeek(
  jobs: Array<{ startedAt: string; status: string }>,
  now: Date = new Date(),
): number {
  const weekStart = startOfIsoWeekMonday(now)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)
  let n = 0
  for (const job of jobs) {
    if (job.status !== "failed") continue
    const t = new Date(job.startedAt)
    if (Number.isNaN(t.getTime()) || t < weekStart || t >= weekEnd) continue
    n += 1
  }
  return n
}
