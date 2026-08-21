"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { api, getResults } from "@/lib/api-client"
import { exportCSV, buildTermOptions } from "@/lib/utils"
import {
  Search, Download, TrendingUp, Award, Users, BarChart2, RefreshCw,
} from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { useGradeConfig } from "@/hooks/use-grade-config"

// ── helpers ────────────────────────────────────────────────────────────────────
function getSubjectScore(r: any, subjectName: string): string {
  const sr = (r.subjectResults || []).find(
    (s: any) => (s.subjectName || "").toLowerCase() === subjectName.toLowerCase()
  )
  return sr ? Number(sr.total).toFixed(1) : "—"
}

// ── page ───────────────────────────────────────────────────────────────────────
export default function ResultsPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()
  const { bands, getGrade } = useGradeConfig()

  // ── selectors
  const [terms, setTerms] = useState(() => buildTermOptions("2026"))
  const [selectedTerm, setSelectedTerm] = useState("Term 2, 2026")
  const [classes, setClasses] = useState<any[]>([])
  const [selectedClassId, setSelectedClassId] = useState("")
  const [selectedClassName, setSelectedClassName] = useState("")

  // extract academic session from term string e.g. "Term 2, 2026" → "2026"
  const academicSession = useMemo(() => {
    const match = selectedTerm.match(/,\s*(.+)$/)
    return match ? match[1].trim() : "2026"
  }, [selectedTerm])

  // ── scoring setup
  const [availableTypes, setAvailableTypes] = useState<string[]>([])
  const [caTypes, setCaTypes] = useState<Set<string>>(new Set())
  const [finalExamType, setFinalExamType] = useState("")
  const [bestN, setBestN] = useState(3)
  const [caWeightPct, setCaWeightPct] = useState(30)

  // ── results data
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [computing, setComputing] = useState(false)
  const [computeMsg, setComputeMsg] = useState<string | null>(null)
  const [loadMsg, setLoadMsg] = useState("")
  const [fetchTick, setFetchTick] = useState(0)

  // ── table filters
  const [search, setSearch] = useState("")
  const [gradeFilter, setGradeFilter] = useState("all")

  // load classes once
  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin", "teacher", "accountant", "parent"].includes(user.role)) return
    api.get("/api/settings/").then(r => {
      const d = Array.isArray(r.data) ? r.data[0] : r.data
      if (!d) return
      const session = d.academicSession || "2026"
      const term = d.currentTerm || "Term 2"
      setTerms(buildTermOptions(session))
      setSelectedTerm(`${term}, ${session}`)
    }).catch(() => {})
    api.get("/api/classes/").then(r => setClasses(getResults(r.data))).catch(() => {})
  }, [user, authLoading])

  // load available exam types when class/term changes
  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin", "teacher", "accountant", "parent"].includes(user.role)) return
    if (!selectedClassId) {
      setAvailableTypes([]); setCaTypes(new Set()); setFinalExamType("")
      return
    }
    api.get(
      `/api/exam-marks/available_types/?student_class=${selectedClassId}` +
      `&term=${encodeURIComponent(selectedTerm)}` +
      `&academic_session=${encodeURIComponent(academicSession)}`
    )
      .then(r => {
        const types: string[] = [...new Set<string>(r.data.types || [])]
        setAvailableTypes(types)
        setCaTypes(new Set(types))   // default: all are CA types
        setFinalExamType("")          // user picks final explicitly
      })
      .catch(() => {
        setAvailableTypes([]); setCaTypes(new Set()); setFinalExamType("")
        setComputeMsg("✗ Could not load the assessments for this class and term.")
      })
  }, [selectedClassId, selectedTerm, academicSession, user, authLoading])

  // load results
  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin", "teacher", "accountant", "parent"].includes(user.role)) return
    if (!selectedClassId) { setResults([]); return }
    setLoading(true)
    api.get(
      `/api/exam-results/?student_class=${selectedClassId}` +
      `&term=${encodeURIComponent(selectedTerm)}` +
      `&academic_session=${encodeURIComponent(academicSession)}` +
      `&page_size=500`   // whole class in one page; the 50-row default clips it
    )
      .then(r => { setResults(getResults(r.data)); setLoadMsg("") })
      .catch(() => { setResults([]); setLoadMsg("Could not load results for this class and term.") })
      .finally(() => setLoading(false))
  }, [selectedClassId, selectedTerm, academicSession, fetchTick, user, authLoading])

  // ── compute
  const activeCaTypes = useMemo(
    () => Array.from(caTypes).filter(t => t !== finalExamType),
    [caTypes, finalExamType]
  )
  const effectiveBestN = bestN === 0 || bestN >= activeCaTypes.length
    ? activeCaTypes.length
    : bestN

  // extract academic session from selected term e.g. "Term 2, 2026" → "2026"
  // (already declared above)

  const handleCompute = async () => {
    if (!user || !["super_admin", "admin", "teacher"].includes(user.role)) return
    if (!selectedClassId) return
    setComputing(true); setComputeMsg(null)
    try {
      const res = await api.post("/api/exam-results/compute_results/", {
        student_class:    selectedClassId,
        term:             selectedTerm,
        academic_session: academicSession,
        ca_types:         activeCaTypes,
        best_n:           bestN,
        final_exam_type:  finalExamType || null,
        ca_weight:        caWeightPct / 100,
      })
      setComputeMsg(`✓ Computed results for ${res.data.computed} student(s).`)
      setFetchTick(t => t + 1)
    } catch (err: any) {
      setComputeMsg(`✗ ${err?.response?.data?.error || "Computation failed."}`)
    } finally {
      setComputing(false)
    }
  }

  const toggleCaType = (type: string, checked: boolean) => {
    setCaTypes(prev => {
      const next = new Set(prev)
      checked ? next.add(type) : next.delete(type)
      return next
    })
  }

  // ── derived
  const subjectColumns = useMemo(() => {
    const names = new Set<string>()
    results.forEach(r =>
      (r.subjectResults || []).forEach((s: any) => { if (s.subjectName) names.add(s.subjectName) })
    )
    return Array.from(names).sort()
  }, [results])

  const gradeOptions = useMemo(
    () => [...bands].sort((a, b) => b.min - a.min).map(b => b.grade),
    [bands]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return results.filter(r => {
      const name = (r.studentName || r.student_name || "").toLowerCase()
      const reg  = (r.regNo || r.reg_no || "").toLowerCase()
      return (
        (name.includes(q) || reg.includes(q)) &&
        (gradeFilter === "all" || r.grade === gradeFilter)
      )
    })
  }, [results, search, gradeFilter])

  const passed     = results.filter(r => r.status === "promoted" || r.status === "passed").length
  const failed     = results.filter(r => r.status === "repeat"   || r.status === "failed").length
  const passRate   = results.length > 0 ? Math.round((passed / results.length) * 100) : 0
  const overallAvg = results.length > 0
    ? (results.reduce((s, r) => s + (Number(r.average) || 0), 0) / results.length).toFixed(1)
    : "0.0"

  const ready = !!selectedClassId

  if (authLoading || !user) return null
  if (!["super_admin", "admin", "teacher", "accountant", "parent"].includes(user.role)) { router.replace("/dashboard"); return null }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <DashboardHeader
        title="Examination Results"
        description="Configure scoring rules, compute results, and view rankings for each class."
      />

      {/* ── Setup Card ── */}
      <Card>
        <CardContent className="pt-5 space-y-5">

          {/* Class + Term selectors */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-1.5 flex-1">
              <span className="text-sm font-medium">Academic Term</span>
              <Select value={selectedTerm} onValueChange={v => {
                setSelectedTerm(v); setSearch(""); setGradeFilter("all")
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {terms.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <span className="text-sm font-medium">Class</span>
              <Select value={selectedClassName} onValueChange={v => {
                const cls = classes.find(c => c.name === v)
                setSelectedClassName(v)
                setSelectedClassId(cls ? String(cls.id) : "")
                setSearch(""); setGradeFilter("all")
              }}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Scoring setup — shown when types are available */}
          {ready && availableTypes.length > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <p className="text-sm font-semibold">Scoring Setup</p>

                {/* CA type checkboxes */}
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    CA Assessments — tick the ones to include
                  </p>
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {availableTypes.filter(t => t !== finalExamType).map(t => (
                      <label key={t} className="flex items-center gap-2 cursor-pointer select-none">
                        <Checkbox
                          checked={caTypes.has(t)}
                          onCheckedChange={v => toggleCaType(t, !!v)}
                        />
                        <span className="text-sm">{t}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">

                  {/* Best N */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Best N CAs to count</Label>
                    <Input
                      type="number" min={1} max={activeCaTypes.length || 99}
                      value={bestN}
                      onChange={e => setBestN(Math.max(1, Number(e.target.value)))}
                    />
                    <p className="text-xs text-muted-foreground">
                      {activeCaTypes.length > 0
                        ? effectiveBestN >= activeCaTypes.length
                          ? `All ${activeCaTypes.length} CAs used`
                          : `Best ${effectiveBestN} of ${activeCaTypes.length}`
                        : "No CAs selected"}
                    </p>
                  </div>

                  {/* Final exam type */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Final Exam Type (optional)</Label>
                    <Select
                      value={finalExamType || "__none__"}
                      onValueChange={v => {
                        const val = v === "__none__" ? "" : v
                        setFinalExamType(val)
                        // remove from CA list when selected as final
                        if (val) setCaTypes(prev => { const n = new Set(prev); n.delete(val); return n })
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {availableTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* CA weight */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">CA Weight (%)</Label>
                    <Input
                      type="number" min={0} max={100}
                      value={caWeightPct}
                      disabled={!finalExamType}
                      onChange={e => setCaWeightPct(Math.min(100, Math.max(0, Number(e.target.value))))}
                    />
                  </div>

                  {/* Exam weight (auto) */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Exam Weight (auto)</Label>
                    <Input type="number" value={100 - caWeightPct} readOnly disabled className="bg-muted/40" />
                  </div>
                </div>

                {/* Formula summary */}
                {activeCaTypes.length > 0 && (
                  <p className="text-xs text-muted-foreground rounded-md bg-muted/40 p-2">
                    <span className="font-medium text-foreground">Formula: </span>
                    best {effectiveBestN} of [{activeCaTypes.join(", ")}] × {caWeightPct}%
                    {finalExamType
                      ? ` + [${finalExamType}] × ${100 - caWeightPct}%`
                      : " (no final exam — CAs are the full score)"}
                  </p>
                )}
              </div>
            </>
          )}

          {ready && availableTypes.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No marks entered yet for this class/term. Go to <strong>Marks Entry</strong> first.
            </p>
          )}

          {!ready && (
            <p className="text-sm text-muted-foreground">
              Select a class to configure scoring and compute results.
            </p>
          )}

          {/* Compute button */}
          <div className="flex items-center gap-4 pt-1">
            <Button
              onClick={handleCompute}
              disabled={!ready || computing || availableTypes.length === 0}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${computing ? "animate-spin" : ""}`} />
              {computing ? "Computing…" : "Compute Results"}
            </Button>
            {computeMsg && (
              <p className={`text-sm ${computeMsg.startsWith("✓") ? "text-accent" : "text-destructive"}`}>
                {computeMsg}
              </p>
            )}
          </div>

        </CardContent>
      </Card>

      {/* ── Stats ── */}
      {ready && results.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total Students",  value: results.length,   icon: Users,      color: "text-primary",     bg: "bg-primary/10" },
            { label: "Passed",          value: passed,           icon: Award,      color: "text-accent",      bg: "bg-accent/10" },
            { label: "Failed",          value: failed,           icon: TrendingUp, color: "text-destructive", bg: "bg-destructive/10" },
            { label: "Overall Average", value: `${overallAvg}%`, icon: BarChart2,  color: "text-blue-600",    bg: "bg-blue-500/10" },
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

      {/* ── Pass Rate ── */}
      {ready && results.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Pass Rate</CardTitle>
              <span className="text-2xl font-bold text-accent">{passRate}%</span>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={passRate} className="h-3" />
            <div className="mt-2 flex gap-6 text-sm text-muted-foreground">
              <span className="text-accent">● Passed: {passed}</span>
              <span className="text-destructive">● Failed: {failed}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Results Table ── */}
      {ready && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Results Table</CardTitle>
                <CardDescription>
                  {selectedClassName} · {selectedTerm}
                  {results.length > 0 && ` · ${results.length} student${results.length !== 1 ? "s" : ""}`}
                </CardDescription>
              </div>
              <Button
                variant="outline" size="sm" className="gap-1"
                disabled={filtered.length === 0}
                onClick={() => exportCSV(filtered, `results-${selectedClassName}-${selectedTerm}.csv`)}
              >
                <Download className="h-4 w-4" />Export
              </Button>
            </div>
            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search student or reg. number…"
                  className="pl-9"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="All Grades" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  {gradeOptions.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                <BarChart2 className="h-10 w-10 text-muted-foreground/40" />
                <p className={`text-sm ${loadMsg ? "text-destructive" : "text-muted-foreground"}`}>
                  {loadMsg
                    ? loadMsg
                    : results.length === 0
                      ? "No results yet. Configure scoring above then click Compute Results."
                      : "No results match your search."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Student</TableHead>
                      {subjectColumns.map(s => (
                        <TableHead key={s} className="hidden md:table-cell text-center">{s}</TableHead>
                      ))}
                      <TableHead className="text-right">Average</TableHead>
                      <TableHead className="text-center">Grade</TableHead>
                      <TableHead className="text-center">Position</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r, idx) => {
                      const avg    = Number(r.average) || 0
                      const name   = r.studentName || r.student_name || "Unknown"
                      const reg    = r.regNo || r.reg_no || ""
                      const grade  = r.grade || "—"
                      const { color } = getGrade(avg)
                      const isPassed = r.status === "promoted" || r.status === "passed"
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{name}</p>
                              <p className="text-xs font-mono text-muted-foreground">{reg}</p>
                            </div>
                          </TableCell>
                          {subjectColumns.map(s => (
                            <TableCell key={s} className="hidden md:table-cell text-center tabular-nums">
                              {getSubjectScore(r, s)}
                            </TableCell>
                          ))}
                          <TableCell className={`text-right font-semibold tabular-nums ${color}`}>
                            {avg.toFixed(1)}%
                          </TableCell>
                          <TableCell className={`text-center font-semibold ${color}`}>{grade}</TableCell>
                          <TableCell className="text-center">{r.position ?? "—"}</TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={isPassed
                                ? "bg-accent/10 text-accent border-accent/30"
                                : "bg-destructive/10 text-destructive border-destructive/30"}
                            >
                              {isPassed ? "Passed" : r.status === "pending" ? "Pending" : "Failed"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

