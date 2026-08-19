import { useCallback, useEffect, useState } from "react"
import { api } from "@/lib/api-client"

/**
 * The school's bell schedule, configured in School Settings and used by every
 * timetable grid. Falls back to a sensible default so a page still renders if
 * the settings request fails.
 */
export type TimetablePeriod = {
  period: number
  label?: string
  start: string
  end: string
  isBreak?: boolean
}

export const DEFAULT_PERIODS: TimetablePeriod[] = [
  { period: 1, label: "Period 1", start: "08:00", end: "08:45", isBreak: false },
  { period: 2, label: "Period 2", start: "08:45", end: "09:30", isBreak: false },
  { period: 3, label: "Period 3", start: "09:45", end: "10:30", isBreak: false },
  { period: 4, label: "Period 4", start: "10:30", end: "11:15", isBreak: false },
  { period: 5, label: "Period 5", start: "11:30", end: "12:15", isBreak: false },
  { period: 6, label: "Period 6", start: "12:15", end: "13:00", isBreak: false },
]

/** Display name for a period — falls back to "Period N" when unnamed. */
export function periodLabel(p: TimetablePeriod): string {
  return (p.label || "").trim() || `Period ${p.period}`
}

/** The time range as stored on a timetable slot, e.g. "08:00 - 08:45". */
export function periodTime(p: TimetablePeriod): string {
  return `${p.start} - ${p.end}`
}

export function normalisePeriods(raw: any[]): TimetablePeriod[] {
  return raw
    .filter((p) => p && p.period != null)
    .map((p) => ({
      period: Number(p.period),
      label: typeof p.label === "string" ? p.label : "",
      start: String(p.start ?? ""),
      end: String(p.end ?? ""),
      isBreak: Boolean(p.isBreak),
    }))
    .filter((p) => Number.isFinite(p.period))
    .sort((a, b) => a.period - b.period)
}

export function useTimetablePeriods() {
  const [periods, setPeriods] = useState<TimetablePeriod[]>(DEFAULT_PERIODS)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    return api
      .get("/api/settings/")
      .then((r) => {
        const d = Array.isArray(r.data) ? r.data[0] : r.data
        if (Array.isArray(d?.timetablePeriods) && d.timetablePeriods.length) {
          setPeriods(normalisePeriods(d.timetablePeriods))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { periods, loading, reload, setPeriods }
}
