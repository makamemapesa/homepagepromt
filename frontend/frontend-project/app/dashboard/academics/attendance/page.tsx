"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { api, getResults } from "@/lib/api-client"
import { useUser } from "@/contexts/user-context"
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  BarChart3,
  AlertTriangle,
  Save,
} from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"

export default function AttendancePage() {
  const today = new Date().toISOString().split("T")[0]
  const { user, loading: authLoading } = useUser()
  const router = useRouter()
  const isTeacher = user?.role === "teacher"

  // --- Shared ---
  const [classes, setClasses] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])

  // --- Class Attendance (read-only summary from student records) ---
  const [selectedDate, setSelectedDate] = useState(today)
  const [classFilter, setClassFilter] = useState("all")
  const [attendanceData, setAttendanceData] = useState<any[]>([])

  // --- Student Attendance ---
  const [stuDate, setStuDate] = useState(today)
  const [stuClass, setStuClass] = useState("")
  const [students, setStudents] = useState<any[]>([])
  const [stuRecords, setStuRecords] = useState<any[]>([])
  const [stuSheet, setStuSheet] = useState<Record<number, string>>({})
  const [stuNotes, setStuNotes] = useState<Record<number, string>>({})
  const [stuSaving, setStuSaving] = useState(false)
  const [stuMsg, setStuMsg] = useState("")

  // --- Teacher Attendance (admin/super_admin only) ---
  const [tchDate, setTchDate] = useState(today)
  const [tchRecords, setTchRecords] = useState<any[]>([])
  const [tchSheet, setTchSheet] = useState<Record<number, string>>({})
  const [tchNotes, setTchNotes] = useState<Record<number, string>>({})
  const [tchSaving, setTchSaving] = useState(false)
  const [tchMsg, setTchMsg] = useState("")

  // Build class attendance aggregates from individual student records
  const fetchClassAggregates = (date: string) => {
    api.get(`/api/student-attendance/?date=${date}`)
      .then(r => {
        const records = getResults(r.data)
        const byClass: Record<number, { studentClass: number; className: string; present: number; absent: number; late: number }> = {}
        records.forEach((rec: any) => {
          const cid = rec.studentClass
          if (!byClass[cid]) {
            byClass[cid] = { studentClass: cid, className: rec.className || "", present: 0, absent: 0, late: 0 }
          }
          if (rec.status === "present") byClass[cid].present++
          else if (rec.status === "absent") byClass[cid].absent++
          else if (rec.status === "late") byClass[cid].late++
        })
        setAttendanceData(Object.values(byClass))
      }).catch(() => {})
  }

  const fetchStudentRecords = (date: string, classId: string) => {
    if (!classId) return
    api.get(`/api/student-attendance/?date=${date}&student_class=${classId}`)
      .then(r => {
        const recs = getResults(r.data)
        setStuRecords(recs)
        const sheet: Record<number, string> = {}
        const notes: Record<number, string> = {}
        recs.forEach((rec: any) => { sheet[rec.student] = rec.status; notes[rec.student] = rec.note || "" })
        setStuSheet(sheet)
        setStuNotes(notes)
      }).catch(() => {})
  }

  const fetchTeacherRecords = (date: string) => {
    api.get(`/api/teacher-attendance/?date=${date}`)
      .then(r => {
        const recs = getResults(r.data)
        setTchRecords(recs)
        const sheet: Record<number, string> = {}
        const notes: Record<number, string> = {}
        recs.forEach((rec: any) => { sheet[rec.teacher] = rec.status; notes[rec.teacher] = rec.note || "" })
        setTchSheet(sheet)
        setTchNotes(notes)
      }).catch(() => {})
  }

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin", "teacher"].includes(user.role)) {
      router.replace("/dashboard")
      return
    }
    // Continue with initialization
  }, [user, authLoading, router])

  // Load classes (scoped by backend: teachers only get their classes)
  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin", "teacher"].includes(user.role)) return
    api.get("/api/classes/").then(r => {
      const cls = getResults(r.data) as any[]
      setClasses(cls)
      // Auto-select first class for teachers (they only have one)
      if (isTeacher && cls.length > 0) {
        setStuClass(String(cls[0].id))
      }
    }).catch(() => {})
    if (!isTeacher) {
      api.get("/api/teachers/").then(r => setTeachers(getResults(r.data))).catch(() => {})
    }
    fetchClassAggregates(today)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher, user, authLoading])

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin", "teacher"].includes(user.role)) return
    fetchClassAggregates(selectedDate)
  }, [selectedDate, user, authLoading])

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin", "teacher"].includes(user.role)) return
    if (stuClass) {
      api.get(`/api/students/?student_class=${stuClass}`).then(r => setStudents(getResults(r.data))).catch(() => {})
      fetchStudentRecords(stuDate, stuClass)
    }
  }, [stuDate, stuClass, user, authLoading])

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin"].includes(user.role)) return
    if (!isTeacher) fetchTeacherRecords(tchDate)
  }, [tchDate, isTeacher, user, authLoading])

  // Save student attendance — class aggregate auto-updates (reads same source)
  const saveStudentAttendance = async () => {
    if (!user || !["super_admin", "admin", "teacher"].includes(user.role)) return
    if (!stuClass) return
    setStuSaving(true); setStuMsg("")
    try {
      for (const student of students) {
        const status = stuSheet[student.id] || "present"
        const note = stuNotes[student.id] || ""
        const existing = stuRecords.find((r: any) => r.student === student.id)
        const payload = { date: stuDate, student: student.id, student_class: parseInt(stuClass), status, note }
        if (existing) {
          await api.patch(`/api/student-attendance/${existing.id}/`, payload)
        } else {
          await api.post("/api/student-attendance/", payload)
        }
      }
      fetchStudentRecords(stuDate, stuClass)
      setSelectedDate(stuDate)
      fetchClassAggregates(stuDate)
      setStuMsg("Attendance saved successfully.")
    } catch {
      setStuMsg("Failed to save some records.")
    } finally { setStuSaving(false) }
  }

  // Save teacher attendance (admin only)
  const saveTeacherAttendance = async () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    setTchSaving(true); setTchMsg("")
    try {
      for (const teacher of teachers) {
        const status = tchSheet[teacher.id] || "present"
        const note = tchNotes[teacher.id] || ""
        const existing = tchRecords.find((r: any) => r.teacher === teacher.id)
        const payload = { date: tchDate, teacher: teacher.id, status, note }
        if (existing) {
          await api.patch(`/api/teacher-attendance/${existing.id}/`, payload)
        } else {
          await api.post("/api/teacher-attendance/", payload)
        }
      }
      fetchTeacherRecords(tchDate)
      setTchMsg("Attendance saved successfully.")
    } catch {
      setTchMsg("Failed to save some records.")
    } finally { setTchSaving(false) }
  }

  const filteredRecords = attendanceData.filter(record =>
    classFilter === "all" || record.className === classFilter
  )

  const totalPresent = filteredRecords.reduce((sum, r) => sum + r.present, 0)
  const totalAbsent = filteredRecords.reduce((sum, r) => sum + r.absent, 0)
  const totalLate = filteredRecords.reduce((sum, r) => sum + r.late, 0)
  const totalStudents = totalPresent + totalAbsent + totalLate
  const attendanceRate = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0

  const chartData = filteredRecords.map(r => ({ class: r.className, present: r.present, absent: r.absent, late: r.late }))

  const stuPresent = Object.values(stuSheet).filter(s => s === "present").length
  const stuAbsent = Object.values(stuSheet).filter(s => s === "absent").length
  const stuLate = Object.values(stuSheet).filter(s => s === "late").length

  const tchPresent = Object.values(tchSheet).filter(s => s === "present").length
  const tchAbsent = Object.values(tchSheet).filter(s => s === "absent").length

  if (authLoading || !user) return null
  if (!["super_admin", "admin", "teacher"].includes(user.role)) { router.replace("/dashboard"); return null }

  return (
    <>
      <DashboardHeader
        title="Attendance Tracking"
        description="Monitor daily attendance across all classes, students, and teachers"
      />

      <div className="p-6 flex flex-col gap-6">
        <Tabs defaultValue="student">
          <TabsList>
            <TabsTrigger value="class">Class Attendance</TabsTrigger>
            <TabsTrigger value="student">Student Attendance</TabsTrigger>
            {!isTeacher && <TabsTrigger value="teacher">Teacher Attendance</TabsTrigger>}
          </TabsList>

          {/* ─── CLASS ATTENDANCE TAB ─── */}
          <TabsContent value="class" className="flex flex-col gap-6 mt-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Date</label>
                      <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-44" />
                    </div>
                    {!isTeacher && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Class</label>
                        <Select value={classFilter} onValueChange={setClassFilter}>
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Classes</SelectItem>
                            {classes.map((cls: any) => (
                              <SelectItem key={cls.id} value={cls.name}>{cls.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" /> Export
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              {[
                { label: "Total Students", value: totalStudents, icon: Users, color: "bg-primary/10 text-primary" },
                { label: "Present", value: totalPresent, icon: CheckCircle, color: "bg-accent/10 text-accent" },
                { label: "Absent", value: totalAbsent, icon: XCircle, color: "bg-destructive/10 text-destructive" },
                { label: "Late", value: totalLate, icon: Clock, color: "bg-yellow-500/10 text-yellow-700" },
                { label: "Attendance Rate", value: `${attendanceRate}%`, icon: BarChart3, color: "bg-chart-4/10 text-chart-4" },
              ].map(s => (
                <Card key={s.label}>
                  <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.color}`}>
                      <s.icon className="h-5 w-5" />
                    </div>
                    <p className="text-2xl font-bold text-card-foreground">{s.value}</p>
                    <p className="text-[11px] text-muted-foreground">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {!isTeacher && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Attendance by Class</CardTitle>
                  <CardDescription>
                    {new Date(selectedDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.01 240)" />
                        <XAxis dataKey="class" tick={{ fontSize: 11 }} stroke="oklch(0.50 0.02 250)" />
                        <YAxis tick={{ fontSize: 11 }} stroke="oklch(0.50 0.02 250)" />
                        <Tooltip contentStyle={{ backgroundColor: "oklch(1 0 0)", border: "1px solid oklch(0.90 0.01 240)", borderRadius: "8px", fontSize: "12px" }} />
                        <Bar dataKey="present" fill="oklch(0.65 0.18 155)" radius={[4,4,0,0]} name="Present" />
                        <Bar dataKey="absent" fill="oklch(0.55 0.22 25)" radius={[4,4,0,0]} name="Absent" />
                        <Bar dataKey="late" fill="oklch(0.75 0.15 75)" radius={[4,4,0,0]} name="Late" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Attendance Summary</CardTitle>
                <CardDescription>Automatically computed from individual student records</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent bg-muted/50">
                        <TableHead className="text-xs font-semibold">Class</TableHead>
                        <TableHead className="text-xs font-semibold">Total</TableHead>
                        <TableHead className="text-xs font-semibold">Present</TableHead>
                        <TableHead className="text-xs font-semibold">Absent</TableHead>
                        <TableHead className="text-xs font-semibold">Late</TableHead>
                        <TableHead className="text-xs font-semibold">Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map(record => {
                        const total = record.present + record.absent + record.late
                        const rate = total > 0 ? Math.round((record.present / total) * 100) : 0
                        return (
                          <TableRow key={record.studentClass}>
                            <TableCell><span className="text-sm font-semibold text-card-foreground">{record.className}</span></TableCell>
                            <TableCell><span className="text-sm text-card-foreground">{total}</span></TableCell>
                            <TableCell><Badge variant="secondary" className="text-[11px] bg-accent/10 text-accent">{record.present}</Badge></TableCell>
                            <TableCell><Badge variant="secondary" className={`text-[11px] ${record.absent > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>{record.absent}</Badge></TableCell>
                            <TableCell><Badge variant="secondary" className={`text-[11px] ${record.late > 0 ? "bg-yellow-500/10 text-yellow-700" : "bg-muted text-muted-foreground"}`}>{record.late}</Badge></TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={rate} className="h-1.5 w-16" />
                                <span className="text-xs font-medium text-card-foreground">{rate}%</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      {filteredRecords.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                            No attendance records for this date. Mark attendance in the Student Attendance tab.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {filteredRecords.some(r => r.absent > 0) && (
              <Card className="border-yellow-400/30 bg-yellow-50/50 dark:bg-yellow-900/10">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-card-foreground">Attendance Alerts</p>
                      {filteredRecords.filter(r => r.absent > 0).map(r => {
                        const total = r.present + r.absent + r.late
                        return (
                          <p key={r.studentClass} className="text-xs text-muted-foreground mt-1">
                            <strong>{r.className}</strong> — {r.absent} absent ({total > 0 ? Math.round((r.absent / total) * 100) : 0}%)
                          </p>
                        )
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ─── STUDENT ATTENDANCE TAB ─── */}
          <TabsContent value="student" className="flex flex-col gap-6 mt-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex items-end gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Date</label>
                      <Input type="date" value={stuDate} onChange={e => setStuDate(e.target.value)} className="w-44" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Class *</label>
                      {isTeacher ? (
                        // Teachers see their class name but cannot change it
                        <div className="flex h-10 w-44 items-center rounded-md border border-input bg-muted px-3 text-sm font-medium">
                          {classes.find(c => String(c.id) === stuClass)?.name || "Loading..."}
                        </div>
                      ) : (
                        <Select value={stuClass} onValueChange={v => setStuClass(v)}>
                          <SelectTrigger className="w-44"><SelectValue placeholder="Select class" /></SelectTrigger>
                          <SelectContent>
                            {classes.map((cls: any) => (
                              <SelectItem key={cls.id} value={String(cls.id)}>{cls.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                  <Button onClick={saveStudentAttendance} disabled={stuSaving || !stuClass}>
                    <Save className="mr-2 h-4 w-4" /> {stuSaving ? "Saving..." : "Save Attendance"}
                  </Button>
                </div>
                {stuMsg && (
                  <p className={`text-xs mt-2 ${stuMsg.includes("saved") ? "text-accent" : "text-destructive"}`}>{stuMsg}</p>
                )}
              </CardContent>
            </Card>

            {stuClass && students.length > 0 && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Present", value: stuPresent, color: "bg-accent/10 text-accent" },
                    { label: "Absent", value: stuAbsent, color: "bg-destructive/10 text-destructive" },
                    { label: "Late", value: stuLate, color: "bg-yellow-500/10 text-yellow-700" },
                  ].map(s => (
                    <Card key={s.label}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.color}`}>
                          <span className="text-base font-bold">{s.value}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{s.label}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">
                      Student Roll — {classes.find(c => String(c.id) === stuClass)?.name}
                    </CardTitle>
                    <CardDescription>Mark attendance for each student. Changes are saved when you click Save.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent bg-muted/50">
                            <TableHead className="text-xs font-semibold">#</TableHead>
                            <TableHead className="text-xs font-semibold">Student</TableHead>
                            <TableHead className="text-xs font-semibold">Reg No.</TableHead>
                            <TableHead className="text-xs font-semibold">Status</TableHead>
                            <TableHead className="text-xs font-semibold hidden md:table-cell">Note</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {students.map((student, idx) => (
                            <TableRow key={student.id}>
                              <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                    {(student.firstName || student.first_name || "?")[0]}{(student.lastName || student.last_name || "")[0]}
                                  </div>
                                  <span className="text-sm font-medium text-card-foreground">
                                    {student.firstName || student.first_name} {student.lastName || student.last_name}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{student.regNo || student.reg_no}</TableCell>
                              <TableCell>
                                <Select
                                  value={stuSheet[student.id] || "present"}
                                  onValueChange={v => setStuSheet(prev => ({ ...prev, [student.id]: v }))}
                                >
                                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="present">Present</SelectItem>
                                    <SelectItem value="absent">Absent</SelectItem>
                                    <SelectItem value="late">Late</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <Input
                                  className="h-8 text-xs w-48"
                                  placeholder="Optional note..."
                                  value={stuNotes[student.id] || ""}
                                  onChange={e => setStuNotes(prev => ({ ...prev, [student.id]: e.target.value }))}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex justify-end mt-4">
                      <Button onClick={saveStudentAttendance} disabled={stuSaving}>
                        <Save className="mr-2 h-4 w-4" /> {stuSaving ? "Saving..." : "Save Attendance"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
            {!stuClass && (
              <Card>
                <CardContent className="py-16 text-center text-sm text-muted-foreground">
                  Select a class above to load the student roll.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ─── TEACHER ATTENDANCE TAB (admin only) ─── */}
          {!isTeacher && (
            <TabsContent value="teacher" className="flex flex-col gap-6 mt-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Date</label>
                      <Input type="date" value={tchDate} onChange={e => setTchDate(e.target.value)} className="w-44" />
                    </div>
                    <Button onClick={saveTeacherAttendance} disabled={tchSaving}>
                      <Save className="mr-2 h-4 w-4" /> {tchSaving ? "Saving..." : "Save Attendance"}
                    </Button>
                  </div>
                  {tchMsg && (
                    <p className={`text-xs mt-2 ${tchMsg.includes("saved") ? "text-accent" : "text-destructive"}`}>{tchMsg}</p>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: "Total Teachers", value: teachers.filter((t: any) => t.status === "active").length, color: "bg-primary/10 text-primary" },
                  { label: "Present", value: tchPresent, color: "bg-accent/10 text-accent" },
                  { label: "Absent", value: tchAbsent, color: "bg-destructive/10 text-destructive" },
                  { label: "On Leave", value: Object.values(tchSheet).filter(s => s === "on_leave").length, color: "bg-muted text-muted-foreground" },
                ].map(s => (
                  <Card key={s.label}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.color}`}>
                        <span className="text-sm font-bold">{s.value}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{s.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    Teacher Roll — {new Date(tchDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                  </CardTitle>
                  <CardDescription>Mark attendance for each teacher then click Save.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent bg-muted/50">
                          <TableHead className="text-xs font-semibold">#</TableHead>
                          <TableHead className="text-xs font-semibold">Teacher</TableHead>
                          <TableHead className="text-xs font-semibold hidden md:table-cell">Department</TableHead>
                          <TableHead className="text-xs font-semibold">Status</TableHead>
                          <TableHead className="text-xs font-semibold hidden md:table-cell">Note</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teachers.filter((t: any) => t.status === "active").map((teacher: any, idx: number) => (
                          <TableRow key={teacher.id}>
                            <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                  {(teacher.name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                                </div>
                                <span className="text-sm font-medium text-card-foreground">{teacher.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <span className="text-xs text-muted-foreground">{teacher.department || "—"}</span>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={tchSheet[teacher.id] || "present"}
                                onValueChange={v => setTchSheet(prev => ({ ...prev, [teacher.id]: v }))}
                              >
                                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="present">Present</SelectItem>
                                  <SelectItem value="absent">Absent</SelectItem>
                                  <SelectItem value="late">Late</SelectItem>
                                  <SelectItem value="on_leave">On Leave</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <Input
                                className="h-8 text-xs w-48"
                                placeholder="Optional note..."
                                value={tchNotes[teacher.id] || ""}
                                onChange={e => setTchNotes(prev => ({ ...prev, [teacher.id]: e.target.value }))}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button onClick={saveTeacherAttendance} disabled={tchSaving}>
                      <Save className="mr-2 h-4 w-4" /> {tchSaving ? "Saving..." : "Save Attendance"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </>
  )
}
