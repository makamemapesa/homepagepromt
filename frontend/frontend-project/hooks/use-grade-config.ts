import { useState, useEffect } from "react"
import { api } from "@/lib/api-client"

export type GradeBand = {
  grade: string
  min: number
  remark?: string
}

export const DEFAULT_GRADE_BANDS: GradeBand[] = [
  { grade: "A", min: 75, remark: "Excellent" },
  { grade: "B", min: 65, remark: "Good" },
  { grade: "C", min: 55, remark: "Average" },
  { grade: "D", min: 45, remark: "Below Average" },
  { grade: "F", min: 0,  remark: "Fail" },
]

/** Map each grade to a CSS color class based on its rank (highest → lowest). */
function buildColorMap(bands: GradeBand[]): Map<string, string> {
  const sorted = [...bands].sort((a, b) => b.min - a.min)
  const colors = [
    "text-accent",        // 1st (best)
    "text-blue-600",      // 2nd
    "text-yellow-600",    // 3rd
    "text-orange-500",    // 4th
    "text-destructive",   // 5th+
  ]
  const map = new Map<string, string>()
  sorted.forEach((band, i) => {
    map.set(band.grade, colors[Math.min(i, colors.length - 1)])
  })
  return map
}

export function useGradeConfig() {
  const [bands, setBands] = useState<GradeBand[]>(DEFAULT_GRADE_BANDS)

  useEffect(() => {
    api.get("/api/settings/")
      .then(r => {
        const d = Array.isArray(r.data) ? r.data[0] : r.data
        if (!d) return
        if (Array.isArray(d.gradeBands) && d.gradeBands.length) {
          setBands(d.gradeBands)
        } else if (d.gradeA != null) {
          // Fallback: construct bands from legacy four-field format
          setBands([
            { grade: "A", min: Number(d.gradeA) || 75, remark: "Excellent" },
            { grade: "B", min: Number(d.gradeB) || 65, remark: "Good" },
            { grade: "C", min: Number(d.gradeC) || 55, remark: "Average" },
            { grade: "D", min: Number(d.gradeD) || 45, remark: "Below Average" },
            { grade: "F", min: 0, remark: "Fail" },
          ])
        }
      })
      .catch(() => {})
  }, [])

  const getGrade = (score: number): { grade: string; color: string; remark: string } => {
    const sorted = [...bands].sort((a, b) => b.min - a.min)
    const colorMap = buildColorMap(bands)
    for (const band of sorted) {
      if (score >= band.min) {
        return {
          grade: band.grade,
          color: colorMap.get(band.grade) ?? "text-muted-foreground",
          remark: band.remark ?? "",
        }
      }
    }
    const last = sorted[sorted.length - 1]
    return {
      grade:  last?.grade  ?? "F",
      color:  colorMap.get(last?.grade ?? "F") ?? "text-destructive",
      remark: last?.remark ?? "",
    }
  }

  return { bands, getGrade }
}
