"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { api, getResults } from "@/lib/api-client"
import { exportCSV, buildTermOptions } from "@/lib/utils"
import { Trophy, Medal, Award, Download, Search, RefreshCw } from "lucide-react"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { useGradeConfig } from "@/hooks/use-grade-config"

const positionIcon = (pos: number) => {
  if (pos === 1) return <Trophy className="h-5 w-5 text-yellow-500" />
  if (pos === 2) return <Medal className="h-5 w-5 text-slate-400" />
  if (pos === 3) return <Award className="h-5 w-5 text-amber-600" />
  return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{pos}</span>
}

export default function MeritListPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()
  const { getGrade } = useGradeConfig()

  const [terms, setTerms] = useState(() => buildTermOptions("2026"))
  const [selectedTerm, setSelectedTerm] = useState("Term 2, 2026")
  const [classes, setClasses] = useState<any[]>([])
  const [selectedClassId, setSelectedClassId] = useState("")
  const [selectedClassName, setSelectedClassName] = useState("")

  const [meritList, setMeritList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadMsg, setLoadMsg] = useState("")
  const [fetchTick, setFetchTick] = useState(0)
  const [search, setSearch] = useState("")

  // "Term 2, 2026" → "2026". Without it the list mixes sessions together.
  const academicSession = useMemo(() => {
    const match = selectedTerm.match(/,\s*(.+)$/)
    return match ? match[1].trim() : "2026"
  }, [selectedTerm])

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin", "teacher"].includes(user.role)) return
    api.get("/api/settings/").then(r => {
      const d = Array.isArray(r.data) ? r.data[0] : r.data
      if (!d) return
      const session = d.academicSession || "2026"
      const term = d.currentTerm || "Term 2"
      setTerms(buildTermOptions(session))
      setSelectedTerm(`${term}, ${session}`)
    }).catch(() => {})
    api.get("/api/classes/")
      .then(r => setClasses(getResults(r.data)))
      .catch(() => {})
  }, [user, authLoading])

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin", "teacher"].includes(user.role)) return
    if (!selectedClassId) { setMeritList([]); return }
    setLoading(true)
    api.get(
      `/api/exam-results/?student_class=${selectedClassId}` +
      `&term=${encodeURIComponent(selectedTerm)}` +
      `&academic_session=${encodeURIComponent(academicSession)}` +
      `&ordering=-average&page_size=500`
    )
      .then(r => {
        const data = getResults(r.data)
        setMeritList(data.map((s: any, i: number) => ({
          ...s,
          position: (s.position != null && s.position > 0) ? s.position : i + 1,
          name: s.studentName || s.student_name || s.name,
          regNo: s.regNo || s.reg_no,
          className: s.className || s.class_name || s.class,
        })))
        setLoadMsg("")
      })
      .catch(() => { setMeritList([]); setLoadMsg("Could not load the merit list for this class and term.") })
      .finally(() => setLoading(false))
  }, [selectedClassId, selectedTerm, academicSession, fetchTick, user, authLoading])

  // Dynamic subject columns from the data
  const subjectColumns = useMemo(() => {
    const seen = new Set<string>()
    const cols: string[] = []
    meritList.forEach(s => {
      ;(s.subjectResults || []).forEach((sr: any) => {
        if (sr.subjectName && !seen.has(sr.subjectName)) {
          seen.add(sr.subjectName)
          cols.push(sr.subjectName)
        }
      })
    })
    return cols
  }, [meritList])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return meritList.filter(s =>
      (s.name || "").toLowerCase().includes(q) ||
      (s.regNo || "").toLowerCase().includes(q)
    )
  }, [meritList, search])

  const ready = !!selectedClassId
  const topThree = meritList.slice(0, 3)
  const avgScore = meritList.length > 0
    ? (meritList.reduce((sum, s) => sum + (Number(s.average) || 0), 0) / meritList.length).toFixed(1)
    : "0.0"
  const passCount = meritList.filter(s => s.status === "promoted" || s.status === "passed").length

  if (authLoading || !user) return null
  if (!["super_admin", "admin", "teacher"].includes(user.role)) { router.replace("/dashboard"); return null }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <DashboardHeader title="Merit List" description="Class ranking of students based on examination performance." />

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
                const cls = classes.find(c => c.name === v)
                setSelectedClassName(v)
                setSelectedClassId(cls ? String(cls.id) : "")
                setSearch("")
              }}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" className="gap-2 self-end" onClick={() => setFetchTick(t => t + 1)} disabled={!ready}>
              <RefreshCw className="h-4 w-4" />Refresh
            </Button>
          </div>
          {!ready && (
            <p className="mt-2 text-sm text-muted-foreground">Select a class to view the merit list.</p>
          )}
        </CardContent>
      </Card>

      {/* Top 3 Podium */}
      {ready && topThree.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {topThree.map(s => {
            const average = Number(s.average) || 0
            const { color } = getGrade(average)
            return (
              <Card key={s.id} className={s.position === 1 ? "border-yellow-400/60 bg-yellow-500/5" : s.position === 2 ? "border-slate-400/60 bg-slate-500/5" : "border-amber-500/60 bg-amber-500/5"}>
                <CardContent className="flex flex-col items-center py-6 gap-3">
                  <div className="flex items-center gap-2">
                    {positionIcon(s.position)}
                    <span className="text-lg font-bold">#{s.position}</span>
                  </div>
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                      {(s.name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-center">
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{s.className}</p>
                  </div>
                  <span className={`text-2xl font-bold ${color}`}>{average.toFixed(1)}%</span>
                  <Badge variant="outline" className={s.position === 1 ? "border-yellow-400 text-yellow-700 bg-yellow-500/10" : ""}>{s.grade || "N/A"}</Badge>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Summary Stats */}
      {ready && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total Students", value: meritList.length },
            { label: "Highest Score",  value: meritList.length > 0 ? `${(Number(meritList[0]?.average) || 0).toFixed(1)}%` : "—" },
            { label: "Class Average",  value: `${avgScore}%` },
            { label: "Pass Rate",      value: meritList.length > 0 ? `${Math.round((passCount / meritList.length) * 100)}%` : "—" },
          ].map(({ label, value }) => (
            <Card key={label}>
              <CardContent className="pt-6">
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Full Merit Table */}
      {ready && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Full Merit List</CardTitle>
                <CardDescription>Class ranking · {selectedClassName} · {selectedTerm}</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-1" disabled={filtered.length === 0} onClick={() => exportCSV(filtered, `merit-list-${selectedClassName}-${selectedTerm}.csv`)}>
                <Download className="h-4 w-4" />Export
              </Button>
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
                <Trophy className="h-10 w-10 text-muted-foreground/40" />
                <p className={`text-sm ${loadMsg ? "text-destructive" : "text-muted-foreground"}`}>
                  {loadMsg
                    ? loadMsg
                    : meritList.length === 0
                      ? "No results yet. Compute results first."
                      : "No students match your search."}
                </p>
              </div>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Rank</TableHead>
                      <TableHead>Student</TableHead>
                      {subjectColumns.map(col => (
                        <TableHead key={col} className="hidden md:table-cell text-center">{col}</TableHead>
                      ))}
                      <TableHead>Average</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead className="hidden sm:table-cell">Performance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(s => {
                      const average = Number(s.average) || 0
                      const { color } = getGrade(average)
                      return (
                        <TableRow key={s.id} className={s.position <= 3 ? "bg-muted/20" : ""}>
                          <TableCell>
                            <div className="flex items-center justify-center">{positionIcon(s.position)}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                  {(s.name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{s.name}</p>
                                <p className="text-xs font-mono text-muted-foreground">{s.regNo}</p>
                              </div>
                            </div>
                          </TableCell>
                          {subjectColumns.map(col => {
                            const sr = (s.subjectResults || []).find((x: any) => x.subjectName === col)
                            const st = Number(sr?.total) || 0
                            const { color: sc } = getGrade(st)
                            return (
                              <TableCell key={col} className={`hidden md:table-cell text-center font-medium ${sr ? sc : "text-muted-foreground"}`}>
                                {sr ? Number(sr.total).toFixed(1) : "—"}
                              </TableCell>
                            )
                          })}
                          <TableCell><span className={`font-semibold ${color}`}>{average.toFixed(1)}%</span></TableCell>
                          <TableCell><span className={`font-semibold ${color}`}>{s.grade || "N/A"}</span></TableCell>
                          <TableCell className="hidden sm:table-cell w-32">
                            <Progress value={average} className="h-1.5" />
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
