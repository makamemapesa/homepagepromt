import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function exportCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const rows = data.map((r) =>
    headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, "'")}"`).join(",")
  )
  const csv = [headers.join(","), ...rows].join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Build a list of term strings covering current year ± 1 year.
 * Tanzania uses single-year sessions: "2026" → ["Term 1, 2025", ..., "Term 3, 2027"]
 * Also handles legacy "2025/2026" split format gracefully.
 */
export function buildTermOptions(session: string): string[] {
  // Support both "2026" (Tanzania) and "2025/2026" (legacy)
  const isSplit = session.includes("/")
  const year = isSplit ? parseInt(session.split("/")[0]) + 1 : parseInt(session)
  const years = [year - 1, year, year + 1]
  const terms: string[] = []
  for (const y of years)
    for (const t of ["Term 1", "Term 2", "Term 3"])
      terms.push(`${t}, ${y}`)
  return terms
}
