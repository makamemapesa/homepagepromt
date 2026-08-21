"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { api, getResults } from "@/lib/api-client"
import { exportCSV, buildTermOptions } from "@/lib/utils"
import { Search, Download, Printer, FileText, GraduationCap, Award, RefreshCw } from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown } from "lucide-react"
import { useGradeConfig } from "@/hooks/use-grade-config"
import { Textarea } from "@/components/ui/textarea"

export default function ReportCardsPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()
  const { getGrade } = useGradeConfig()

  const [terms, setTerms] = useState(() => buildTermOptions("2026"))
  const [selectedTerm, setSelectedTerm] = useState("Term 2, 2026")
  const [classes, setClasses] = useState<any[]>([])
  const [selectedClassId, setSelectedClassId] = useState("")
  const [selectedClassName, setSelectedClassName] = useState("")

  const [reportCardData, setReportCardData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadMsg, setLoadMsg] = useState("")
  const [fetchTick, setFetchTick] = useState(0)

  // "Term 2, 2026" → "2026", so a term number can't pull in another year's cards.
  const academicSession = useMemo(() => {
    const match = selectedTerm.match(/,\s*(.+)$/)
    return match ? match[1].trim() : "2026"
  }, [selectedTerm])
  const [search, setSearch] = useState("")
  const [selectedReport, setSelectedReport] = useState<any>(null)
  const [schoolName, setSchoolName] = useState("School")
  const [teacherComment, setTeacherComment] = useState("")
  const [studentAttendance, setStudentAttendance] = useState<{ present: number; absent: number; late: number } | null>(null)
  const [studentPayments, setStudentPayments] = useState<{ total: number; confirmed: number; pending: number; records: any[] } | null>(null)
  const [paidStudentIds, setPaidStudentIds] = useState<Set<number>>(new Set())
  const [savingComment, setSavingComment] = useState(false)
  const [commentSaved, setCommentSaved] = useState(false)
  const [commentMsg, setCommentMsg] = useState("")

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin", "teacher", "accountant", "parent"].includes(user.role)) return
    setTeacherComment(selectedReport?.teacherComment || "")
    setCommentSaved(false)
    setCommentMsg("")
    setStudentAttendance(null)
    setStudentPayments(null)
    if (!selectedReport) return
    const studentId = selectedReport.student

    // Fetch attendance for this student. page_size matters — a term runs to ~60
    // school days, so the 50-row default silently under-counts every total below.
    api.get(`/api/student-attendance/?student=${studentId}&page_size=500`)
      .then(r => {
        const records: any[] = Array.isArray(r.data) ? r.data : (r.data?.results ?? [])
        const present = records.filter(a => a.status === "present").length
        const absent  = records.filter(a => a.status === "absent").length
        const late    = records.filter(a => a.status === "late").length
        setStudentAttendance({ present, absent, late })
      })
      .catch(() => setStudentAttendance({ present: 0, absent: 0, late: 0 }))

    // Fetch payments for this student filtered by term
    const term = selectedReport.term || selectedTerm
    api.get(`/api/fees/payments/?student=${studentId}&term=${encodeURIComponent(term)}&page_size=500`)
      .then(r => {
        const records: any[] = Array.isArray(r.data) ? r.data : (r.data?.results ?? [])
        const confirmed = records.filter(p => p.status === "confirmed").reduce((s, p) => s + Number(p.amount), 0)
        const pending   = records.filter(p => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0)
        setStudentPayments({ total: confirmed + pending, confirmed, pending, records })
      })
      .catch(() => setStudentPayments({ total: 0, confirmed: 0, pending: 0, records: [] }))
  }, [selectedReport, user, authLoading])

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin", "teacher", "accountant", "parent"].includes(user.role)) return
    api.get("/api/settings/")
      .then(r => {
        const d = Array.isArray(r.data) ? r.data[0] : r.data
        if (!d) return
        if (d?.schoolName || d?.school_name) setSchoolName(d.schoolName || d.school_name)
        const session = d.academicSession || "2026"
        const term = d.currentTerm || "Term 2"
        setTerms(buildTermOptions(session))
        setSelectedTerm(`${term}, ${session}`)
      })
      .catch(() => {})
    api.get("/api/classes/")
      .then(r => setClasses(getResults(r.data)))
      .catch(() => {})
  }, [user, authLoading])

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin", "teacher", "accountant", "parent"].includes(user.role)) return
    if (!selectedClassId) { setReportCardData([]); setPaidStudentIds(new Set()); return }
    setLoading(true)
    // "All classes" over a whole school is well past one page, and a clipped list
    // reads as "these students have no report card" rather than as a missing page.
    const scope = selectedClassId === "all" ? "" : `student_class=${selectedClassId}&`
    const url =
      `/api/exam-results/?${scope}term=${encodeURIComponent(selectedTerm)}` +
      `&academic_session=${encodeURIComponent(academicSession)}&page_size=500`
    api.get(url)
      .then(r => { setReportCardData(getResults(r.data)); setLoadMsg("") })
      .catch(() => { setReportCardData([]); setLoadMsg("Could not load report cards for this class and term.") })
      .finally(() => setLoading(false))
    // Fetch all payments for the term to know which students are fully paid
    api.get(`/api/fees/payments/?term=${encodeURIComponent(selectedTerm)}&page_size=500`)
      .then(r => {
        const records: any[] = getResults(r.data)
        const byStudent = new Map<number, { confirmed: number; pending: number }>()
        for (const p of records) {
          const sid = Number(p.student)
          if (!byStudent.has(sid)) byStudent.set(sid, { confirmed: 0, pending: 0 })
          const entry = byStudent.get(sid)!
          if (p.status === "confirmed") entry.confirmed += Number(p.amount)
          else if (p.status === "pending") entry.pending += Number(p.amount)
        }
        const paid = new Set<number>()
        for (const [sid, { confirmed, pending }] of byStudent) {
          if (confirmed > 0 && pending === 0) paid.add(sid)
        }
        setPaidStudentIds(paid)
      })
      .catch(() => setPaidStudentIds(new Set()))
  }, [selectedClassId, selectedTerm, academicSession, fetchTick, user, authLoading])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return reportCardData.filter(r => {
      const name = (r.studentName || r.student_name || "").toLowerCase()
      const reg  = (r.regNo || r.reg_no || "").toLowerCase()
      return name.includes(q) || reg.includes(q)
    })
  }, [reportCardData, search])

  const published = reportCardData.filter(r => r.status === "promoted" || r.status === "passed").length
  const ready = !!selectedClassId

  const classTeacherName = useMemo(() => {
    const cls = classes.find(c => String(c.id) === String(selectedClassId))
    return cls?.classTeacherName || cls?.class_teacher_name || ""
  }, [classes, selectedClassId])

  const buildCardHtml = (r: any, comment: string, ctName: string, att?: { present: number; absent: number; late: number } | null, pay?: { confirmed: number; pending: number; records: any[] } | null) => {
    const avg = Number(r.average) || 0
    const name = r.studentName || r.student_name || "Student"
    const reg = r.regNo || r.reg_no || ""
    const cls = r.className || r.class_name || ""
    const isPassed = r.status === "promoted" || r.status === "passed"
    const now = new Date().toLocaleDateString("en-GB")
    const subjectRows = (r.subjectResults || []).map((s: any) =>
      `<tr><td>${s.subjectName || ""}</td><td>${Number(s.caScore || 0).toFixed(1)}</td><td>${Number(s.examScore || 0).toFixed(1)}</td><td><strong>${Number(s.total || 0).toFixed(1)}</strong></td><td>${s.grade || "—"}</td></tr>`
    ).join("")

    const attTotal = att ? att.present + att.absent + att.late : 0
    const attRate = attTotal > 0 ? Math.round((att!.present / attTotal) * 100) : 0
    const attendanceHtml = att ? `
  <div class="section-title">Attendance Summary</div>
  <div class="att-grid">
    <div class="att-box"><div class="att-num">${att.present}</div><div class="att-label">Present</div></div>
    <div class="att-box"><div class="att-num">${att.absent}</div><div class="att-label">Absent</div></div>
    <div class="att-box"><div class="att-num">${att.late}</div><div class="att-label">Late</div></div>
    <div class="att-box"><div class="att-num">${attRate}%</div><div class="att-label">Rate (${attTotal} days)</div></div>
  </div>` : ""

    const payStatus = pay
      ? pay.confirmed > 0 && pay.pending === 0 ? "Paid"
      : pay.confirmed > 0 && pay.pending > 0 ? "Partial"
      : pay.pending > 0 ? "Not Paid"
      : "Not Paid"
      : "Not Paid"
    const paymentHtml = pay ? `
  <div class="section-title">Fee Payment — ${r.term || selectedTerm}</div>
  <div class="pay-summary"><strong>Payment Status:</strong> ${payStatus}</div>` : ""

    return `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Report Card — ${name}</title><style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 0; padding: 24px; color: #000; }
  .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #000; padding-bottom: 12px; }
  .header h1 { margin: 0 0 4px; font-size: 20px; } .header p { margin: 2px 0; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 16px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11px; }
  th, td { border: 1px solid #999; padding: 5px 8px; text-align: center; } th { background: #f0f0f0; font-weight: bold; } td:first-child { text-align: left; }
  .summary { display: flex; justify-content: space-between; background: #f5f5f5; padding: 8px 12px; margin-bottom: 14px; border: 1px solid #ccc; font-size: 12px; }
  .section-title { font-weight: bold; font-size: 12px; margin: 12px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
  .att-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 12px; }
  .att-box { border: 1px solid #ddd; border-radius: 4px; text-align: center; padding: 6px 4px; background: #fafafa; }
  .att-num { font-size: 16px; font-weight: bold; } .att-label { font-size: 9px; color: #666; }
  .pay-summary { display: flex; gap: 24px; margin-bottom: 8px; font-size: 12px; }
  .comment-section { margin-bottom: 12px; } .comment-section label { font-weight: bold; display: block; margin-bottom: 4px; }
  .comment-box { border: 1px solid #999; padding: 8px; min-height: 48px; background: #fafafa; white-space: pre-wrap; }
  .signature-section { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 24px; }
  .sig-line { border-bottom: 1px solid #000; height: 28px; margin-bottom: 4px; } .sig-label { font-size: 10px; color: #555; margin-bottom: 10px; }
  @media print { body { padding: 10px; } }
</style></head><body>
  <div class="header"><h1>${schoolName}</h1><p><strong>Student Academic Report Card</strong></p><p>${r.term || selectedTerm}</p></div>
  <div class="info-grid">
    <div><strong>Name:</strong> ${name}</div><div><strong>Reg. No.:</strong> ${reg}</div>
    <div><strong>Class:</strong> ${cls}</div><div><strong>Position:</strong> ${r.position || "—"}</div>
    <div><strong>Status:</strong> ${isPassed ? "Promoted" : "Repeat"}</div><div><strong>Date:</strong> ${now}</div>
  </div>
  <table><thead><tr><th>Subject</th><th>CA</th><th>Exam</th><th>Total</th><th>Grade</th></tr></thead>
  <tbody>${subjectRows || '<tr><td colspan="5" style="text-align:center">No subject data</td></tr>'}</tbody></table>
  <div class="summary"><span><strong>Overall Average:</strong> ${avg.toFixed(1)}%</span><span><strong>Grade:</strong> ${r.grade || "—"}</span><span><strong>Division:</strong> ${r.division ? "Division " + r.division : "—"}</span><span><strong>Remark:</strong> ${isPassed ? "Promoted" : "Repeat"}</span></div>
  ${attendanceHtml}
  ${paymentHtml}
  <div class="comment-section"><label>Class Teacher's Comment:</label><div class="comment-box">${comment.replace(/</g, "&lt;").replace(/>/g, "&gt;") || "&nbsp;"}</div></div>
  <div class="signature-section">
    <div><p><strong>Class Teacher</strong></p><div class="sig-line"></div><div class="sig-label">Signature</div><div class="sig-line"></div><div class="sig-label">Name: ${ctName || "___________________________"}</div><div class="sig-line"></div><div class="sig-label">Date</div></div>
    <div><p><strong>Principal / Head Teacher</strong></p><div class="sig-line"></div><div class="sig-label">Signature</div><div class="sig-line"></div><div class="sig-label">Name: ___________________________</div><div class="sig-line"></div><div class="sig-label">Date</div></div>
  </div>
</body></html>`
  }

  const printCard = (r: any, comment: string, ctName: string, att?: typeof studentAttendance, pay?: typeof studentPayments) => {
    const html = buildCardHtml(r, comment, ctName, att, pay)
    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  const downloadCard = (r: any, comment: string, ctName: string, att?: typeof studentAttendance, pay?: typeof studentPayments) => {
    const html = buildCardHtml(r, comment, ctName, att, pay)
    const name = r.studentName || r.student_name || "Student"
    const blob = new Blob([html], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `Report-Card-${name.replace(/\s+/g, "-")}-${r.term || selectedTerm}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPDF = () => {
    const paidFiltered = filtered.filter(r => paidStudentIds.has(Number(r.student)))
    if (paidFiltered.length === 0) return
    const now = new Date().toLocaleDateString("en-GB")
    const rows = paidFiltered.map(r => {
      const avg = Number(r.average) || 0
      const name = r.studentName || r.student_name || "Student"
      const reg = r.regNo || r.reg_no || ""
      const cls = r.className || r.class_name || ""
      const isPassed = r.status === "promoted" || r.status === "passed"
      return `<tr><td>${name}</td><td class="mono">${reg}</td><td>${cls}</td><td>${r.position || "—"}</td><td>${avg.toFixed(1)}%</td><td>${r.grade || "—"}</td><td>${r.division ? "Div " + r.division : "—"}</td><td>${isPassed ? "Promoted" : "Repeat"}</td></tr>`
    }).join("")
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Report Cards — ${selectedClassName} — ${selectedTerm}</title><style>
  body { font-family: Arial, sans-serif; font-size: 12px; padding: 24px; color: #000; }
  h2 { margin: 0 0 4px; } p { margin: 0 0 16px; color: #555; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #999; padding: 6px 10px; } th { background: #f0f0f0; } .mono { font-family: monospace; }
  @media print { body { padding: 10px; } }
</style></head><body>
  <h2>${schoolName}</h2>
  <p>Report Cards &mdash; ${selectedClassName} &mdash; ${selectedTerm} &nbsp;|&nbsp; Printed: ${now}</p>
  <table><thead><tr><th>Student</th><th>Reg. No.</th><th>Class</th><th>Position</th><th>Average</th><th>Grade</th><th>Division</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`
    const blob = new Blob([html], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `Report-Cards-${selectedClassName}-${selectedTerm}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (authLoading || !user) return null
  if (!["super_admin", "admin", "teacher", "accountant", "parent"].includes(user.role)) { router.replace("/dashboard"); return null }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <DashboardHeader title="Report Cards" description="Generate and distribute end-of-term student report cards." />

      {/* Selectors */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-1.5 flex-1">
              <span className="text-sm font-medium">Academic Term</span>
              <Select value={selectedTerm} onValueChange={v => { setSelectedTerm(v); setSearch("") }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {terms.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <span className="text-sm font-medium">Class</span>
              <Select value={selectedClassName} onValueChange={v => {
                if (v === "All Classes") {
                  setSelectedClassName("All Classes")
                  setSelectedClassId("all")
                } else {
                  const cls = classes.find(c => c.name === v)
                  setSelectedClassName(v)
                  setSelectedClassId(cls ? String(cls.id) : "")
                }
                setSearch("")
              }}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Classes">All Classes</SelectItem>
                  {classes.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" className="gap-2 self-end" onClick={() => setFetchTick(t => t + 1)} disabled={!ready}>
              <RefreshCw className="h-4 w-4" />Refresh
            </Button>
          </div>
          {!ready && (
            <p className="mt-2 text-sm text-muted-foreground">
              Select a class to view report cards. Make sure results have been computed first.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      {ready && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total Reports", value: reportCardData.length, icon: FileText,       color: "text-primary",     bg: "bg-primary/10" },
            { label: "Published",     value: published,             icon: Award,          color: "text-accent",      bg: "bg-accent/10" },
            { label: "Pending",       value: reportCardData.length - published, icon: GraduationCap, color: "text-yellow-600", bg: "bg-yellow-500/10" },
            { label: "Class",         value: selectedClassName || "—", icon: Download,    color: "text-blue-600",    bg: "bg-blue-500/10" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label}>
              <CardContent className="flex items-center gap-4 pt-6">
                <div className={`rounded-lg p-2 ${bg}`}><Icon className={`h-5 w-5 ${color}`} /></div>
                <div><p className="text-2xl font-bold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Table */}
      {ready && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Report Card List</CardTitle>
                <CardDescription>{selectedClassName} · {selectedTerm} · Click &quot;View&quot; to open full report card</CardDescription>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1" disabled={filtered.length === 0}>
                    <Download className="h-4 w-4" />Export All<ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportCSV(filtered.filter(r => paidStudentIds.has(Number(r.student))), `report-cards-${selectedClassName}-${selectedTerm}.csv`)}>
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportPDF}>
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="relative pt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground mt-1" />
              <Input placeholder="Search student..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                <FileText className="h-10 w-10 text-muted-foreground/40" />
                <p className={`text-sm ${loadMsg ? "text-destructive" : "text-muted-foreground"}`}>
                  {loadMsg
                    ? loadMsg
                    : reportCardData.length === 0
                      ? "No report cards yet. Compute results first."
                      : "No students match your search."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Average</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Division</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => {
                    const avg = Number(r.average) || 0
                    const name = r.studentName || r.student_name || "Unknown"
                    const reg = r.regNo || r.reg_no || ""
                    const { color } = getGrade(avg)
                    const isPassed = r.status === "promoted" || r.status === "passed"
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{name}</p>
                            <p className="text-xs font-mono text-muted-foreground">{reg}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{r.position || "—"}</TableCell>
                        <TableCell><span className={`font-semibold ${color}`}>{avg.toFixed(1)}%</span></TableCell>
                        <TableCell><span className={`font-semibold ${color}`}>{r.grade || "—"}</span></TableCell>
                        <TableCell><span className="text-sm font-medium">{r.division ? `Div ${r.division}` : "—"}</span></TableCell>
                        <TableCell>
                          <Badge variant="outline" className={isPassed ? "bg-accent/10 text-accent border-accent/30" : "bg-yellow-500/10 text-yellow-700 border-yellow-400/30"}>
                            {isPassed ? "Published" : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setSelectedReport(r)}>
                            <FileText className="h-3 w-3" />View
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Report Card Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report Card — {selectedReport?.studentName || selectedReport?.student_name}</DialogTitle>
          </DialogHeader>
          {selectedReport && (() => {
            const avg = Number(selectedReport.average) || 0
            const { color } = getGrade(avg)
            const name = selectedReport.studentName || selectedReport.student_name || ""
            const reg = selectedReport.regNo || selectedReport.reg_no || ""
            const className = selectedReport.className || selectedReport.class_name || ""
            const isPassed = selectedReport.status === "promoted" || selectedReport.status === "passed"
            const isPaid = studentPayments !== null
              && studentPayments.confirmed > 0
              && studentPayments.pending === 0
            return (
              <div className="space-y-4">
                <div className="rounded-lg border bg-primary/5 p-4 text-center">
                  <p className="text-lg font-bold text-primary">{schoolName}</p>
                  <p className="text-sm text-muted-foreground">Student Academic Report — {selectedReport.term || selectedTerm}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Name: </span><span className="font-medium">{name}</span></div>
                  <div><span className="text-muted-foreground">Reg. No.: </span><span className="font-mono">{reg}</span></div>
                  <div><span className="text-muted-foreground">Class: </span><span className="font-medium">{className}</span></div>
                  <div><span className="text-muted-foreground">Position: </span><span className="font-medium">{selectedReport.position || "—"}</span></div>
                </div>
                <Separator />
                {(selectedReport.subjectResults || []).length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead className="text-center">CA</TableHead>
                        <TableHead className="text-center">Exam</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                        <TableHead className="text-center">Grade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selectedReport.subjectResults || []).map((s: any) => {
                        const st = Number(s.total) || 0
                        const { color: sc } = getGrade(st)
                        return (
                          <TableRow key={s.subjectName || s.id}>
                            <TableCell className="font-medium">{s.subjectName}</TableCell>
                            <TableCell className="text-center">{Number(s.caScore || 0).toFixed(1)}</TableCell>
                            <TableCell className="text-center">{Number(s.examScore || 0).toFixed(1)}</TableCell>
                            <TableCell className={`text-center font-semibold ${sc}`}>{Number(s.total || 0).toFixed(1)}</TableCell>
                            <TableCell className={`text-center font-semibold ${sc}`}>{s.grade || "—"}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No subject breakdown available.</p>
                )}
                <Separator />
                <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3">
                  <span className="font-medium">Overall Average</span>
                  <div className="flex items-center gap-3">
                    <span className={`text-xl font-bold ${color}`}>{avg.toFixed(1)}% — {selectedReport.grade || "N/A"}</span>
                    {selectedReport.division && (
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                        Division {selectedReport.division}
                      </span>
                    )}
                  </div>
                </div>
                <Progress value={avg} className="h-2" />
                <Separator />
                {/* Attendance Summary */}
                {studentAttendance && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Attendance Summary</p>
                    <div className="grid grid-cols-3 gap-3 text-center text-sm">
                      <div className="rounded-lg bg-accent/10 py-2 px-3">
                        <p className="text-xl font-bold text-accent">{studentAttendance.present}</p>
                        <p className="text-xs text-muted-foreground">Present</p>
                      </div>
                      <div className="rounded-lg bg-destructive/10 py-2 px-3">
                        <p className="text-xl font-bold text-destructive">{studentAttendance.absent}</p>
                        <p className="text-xs text-muted-foreground">Absent</p>
                      </div>
                      <div className="rounded-lg bg-yellow-500/10 py-2 px-3">
                        <p className="text-xl font-bold text-yellow-600">{studentAttendance.late}</p>
                        <p className="text-xs text-muted-foreground">Late</p>
                      </div>
                    </div>
                    {(() => {
                      const total = studentAttendance.present + studentAttendance.absent + studentAttendance.late
                      const rate = total > 0 ? Math.round((studentAttendance.present / total) * 100) : 0
                      return <p className="text-xs text-muted-foreground mt-1 text-right">Attendance rate: {rate}% ({total} days recorded)</p>
                    })()}
                  </div>
                )}
                <Separator />
                {/* Fee Payment Status */}
                {studentPayments && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Fee Payment Status — {selectedReport.term || selectedTerm}</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">Confirmed Paid</p>
                        <p className="text-lg font-bold text-accent">TSh {studentPayments.confirmed.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">Pending</p>
                        <p className="text-lg font-bold text-yellow-600">TSh {studentPayments.pending.toLocaleString()}</p>
                      </div>
                    </div>
                    {studentPayments.records.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {studentPayments.records.slice(0, 5).map((p: any, i: number) => (
                          <div key={i} className="flex justify-between text-xs text-muted-foreground border-b pb-1">
                            <span>{p.category || p.method}</span>
                            <span>{p.date}</span>
                            <span className={p.status === "confirmed" ? "text-accent font-medium" : "text-yellow-600"}>TSh {Number(p.amount).toLocaleString()} ({p.status})</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {studentPayments.records.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-1">No payments recorded for this term.</p>
                    )}
                  </div>
                )}
                <Separator />
                {/* Comments */}
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Class Teacher's Comment</label>
                    <Textarea
                      placeholder="Enter class teacher's comment..."
                      value={teacherComment}
                      onChange={e => { setTeacherComment(e.target.value); setCommentSaved(false); setCommentMsg("") }}
                      rows={3}
                      disabled={user?.role === "parent"}
                    />
                    {user?.role !== "parent" && (
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={savingComment}
                          onClick={() => {
                            if (!selectedReport?.id) return
                            setSavingComment(true); setCommentMsg("")
                            api.patch(`/api/exam-results/${selectedReport.id}/`, { teacherComment })
                              .then(r => {
                                setReportCardData(prev => prev.map(x => x.id === selectedReport.id ? { ...x, teacherComment: r.data.teacherComment } : x))
                                setSelectedReport((prev: any) => prev ? { ...prev, teacherComment: r.data.teacherComment } : prev)
                                setCommentSaved(true)
                              })
                              .catch(err => setCommentMsg(
                                err?.response?.status === 403
                                  ? "You are not allowed to comment on this report card."
                                  : "Could not save the comment. It has not been recorded."
                              ))
                              .finally(() => setSavingComment(false))
                          }}
                        >
                          {savingComment ? "Saving…" : "Save Comment"}
                        </Button>
                        {commentSaved && <span className="text-xs text-accent">Saved ✓</span>}
                        {commentMsg && <span className="text-xs text-destructive">{commentMsg}</span>}
                      </div>
                    )}
                  </div>
                </div>
                <Separator />
                {/* Signatures */}
                <div className="grid grid-cols-2 gap-6 text-sm pt-2">
                  <div className="space-y-1">
                    <p className="font-semibold">Class Teacher</p>
                    <div className="h-8 border-b border-dashed border-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Signature</p>
                    <div className="h-6 border-b border-dashed border-muted-foreground mt-3" />
                    <p className="text-xs text-muted-foreground">Name: {classTeacherName || "___________________"}</p>
                    <div className="h-6 border-b border-dashed border-muted-foreground mt-3" />
                    <p className="text-xs text-muted-foreground">Date</p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold">Principal / Head Teacher</p>
                    <div className="h-8 border-b border-dashed border-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Signature</p>
                    <div className="h-6 border-b border-dashed border-muted-foreground mt-3" />
                    <p className="text-xs text-muted-foreground">Name: ___________________</p>
                    <div className="h-6 border-b border-dashed border-muted-foreground mt-3" />
                    <p className="text-xs text-muted-foreground">Date</p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  {studentPayments !== null && !isPaid && (
                    <p className="text-xs text-destructive text-right">
                      Print and download are disabled until all fees are fully paid.
                    </p>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <Badge variant="outline" className={isPassed ? "bg-accent/10 text-accent border-accent/30" : "bg-destructive/10 text-destructive border-destructive/30"}>
                      {isPassed ? "Promoted" : "Repeat"}
                    </Badge>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-2" disabled={!isPaid} onClick={() => printCard(selectedReport, teacherComment, classTeacherName, studentAttendance, studentPayments)}><Printer className="h-4 w-4" />Print</Button>
                      <Button variant="outline" size="sm" className="gap-2" disabled={!isPaid} onClick={() => downloadCard(selectedReport, teacherComment, classTeacherName, studentAttendance, studentPayments)}><Download className="h-4 w-4" />Download PDF</Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
