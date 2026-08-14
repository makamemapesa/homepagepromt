"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { api, getResults } from "@/lib/api-client"
import {
  Calendar,
  Clock,
  BookOpen,
  Users,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  Plus,
  MapPin,
  GraduationCap,
} from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"


const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const
const PERIODS = [
  { period: 1, time: "8:00 - 8:45" },
  { period: 2, time: "8:45 - 9:30" },
  { period: 3, time: "9:45 - 10:30" },
  { period: 4, time: "10:30 - 11:15" },
  { period: 5, time: "11:30 - 12:15" },
  { period: 6, time: "12:15 - 1:00" },
]

const PERIOD_COLORS = [
  "bg-primary/10 text-primary border-primary/20",
  "bg-accent/10 text-accent border-accent/20",
  "bg-chart-3/10 text-chart-3 border-chart-3/20",
  "bg-chart-4/10 text-chart-4 border-chart-4/20",
  "bg-chart-5/10 text-chart-5 border-chart-5/20",
  "bg-primary/10 text-primary border-primary/20",
]

const eventTypeColors: Record<string, string> = {
  term: "bg-primary text-primary-foreground",
  break: "bg-chart-3/10 text-chart-3",
  exam: "bg-destructive/10 text-destructive",
  event: "bg-accent/10 text-accent",
}

const EMPTY_SLOT = { day: "", period: "", subject: "", teacher: "", room: "" }

export default function TimetablePage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()
  const [selectedClass, setSelectedClass] = useState("")
  const [timetableData, setTimetableData] = useState<any[]>([])
  const [calendarEvents, setCalendarEvents] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [subjectsData, setSubjectsData] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])

  const [addSlotOpen, setAddSlotOpen] = useState(false)
  const [addForm, setAddForm] = useState({ ...EMPTY_SLOT })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState("")

  const [editTarget, setEditTarget] = useState<any>(null)
  const [editForm, setEditForm] = useState({ ...EMPTY_SLOT })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState("")

  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchTimetable = () => api.get("/api/timetable/").then(r => setTimetableData(getResults(r.data))).catch(() => {})

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin", "teacher"].includes(user.role)) return
    fetchTimetable()
    api.get("/api/academic-calendar/").then(r => setCalendarEvents(getResults(r.data))).catch(() => {})
    api.get("/api/classes/").then(r => {
      const cls = getResults(r.data) as any[]
      setClasses(cls)
      if (cls.length > 0 && !selectedClass) setSelectedClass(cls[0].name)
    }).catch(() => {})
    api.get("/api/subjects/").then(r => setSubjectsData(getResults(r.data))).catch(() => {})
    api.get("/api/teachers/").then(r => setTeachers(getResults(r.data))).catch(() => {})
  }, [user, authLoading])

  const selectedClassObj = classes.find((c: any) => c.name === selectedClass)

  const buildPayload = (form: typeof EMPTY_SLOT) => ({
    day: form.day,
    period: parseInt(form.period),
    time: PERIODS.find(p => p.period === parseInt(form.period))?.time || "",
    studentClass: selectedClassObj?.id,
    subject: parseInt(form.subject),
    teacher: form.teacher ? parseInt(form.teacher) : null,
    room: form.room,
  })

  const handleAdd = () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    setAddLoading(true); setAddError("")
    api.post("/api/timetable/", buildPayload(addForm))
      .then(() => { fetchTimetable(); setAddSlotOpen(false); setAddForm({ ...EMPTY_SLOT }) })
      .catch((e: any) => setAddError(
        e?.response?.data?.detail ||
        e?.response?.data?.nonFieldErrors?.[0] ||
        "Failed to add slot"
      ))
      .finally(() => setAddLoading(false))
  }

  const openEdit = (slot: any) => {
    setEditForm({
      day: slot.day || "",
      period: String(slot.period || ""),
      subject: String(slot.subject || slot.subjectId || ""),
      teacher: String(slot.teacher || slot.teacherId || ""),
      room: slot.room || "",
    })
    setEditTarget(slot)
  }

  const handleEdit = () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    setEditLoading(true); setEditError("")
    api.patch(`/api/timetable/${editTarget.id}/`, buildPayload(editForm))
      .then(() => { fetchTimetable(); setEditTarget(null) })
      .catch((e: any) => setEditError(
        e?.response?.data?.detail ||
        e?.response?.data?.nonFieldErrors?.[0] ||
        "Failed to update slot"
      ))
      .finally(() => setEditLoading(false))
  }

  const handleDelete = () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    setDeleteLoading(true)
    api.delete(`/api/timetable/${deleteTarget.id}/`)
      .then(() => { fetchTimetable(); setDeleteTarget(null) })
      .catch(() => {})
      .finally(() => setDeleteLoading(false))
  }

  const classTimetable = timetableData.filter((t: any) => {
    return t.className === selectedClass || t.class === selectedClass ||
      (selectedClassObj && (t.studentClass === selectedClassObj.id || t.studentClassId === selectedClassObj.id))
  })

  const getTimetableSlot = (day: string, period: number) =>
    classTimetable.find(t => t.day === day && t.period === period)

  // ── Teacher availability helpers ──────────────────────────────────────────
  const addTeacherId = addForm.teacher ? parseInt(addForm.teacher) : null
  const addTeacherSlots = addTeacherId
    ? timetableData.filter((t: any) => t.teacher === addTeacherId || t.teacherId === addTeacherId)
    : []
  const addTeacherBusyOnDay = addForm.day
    ? addTeacherSlots.filter((t: any) => t.day === addForm.day).map((t: any) => t.period)
    : []
  const addConflict = addTeacherId && addForm.day && addForm.period
    ? (addTeacherSlots.find((t: any) => t.day === addForm.day && t.period === parseInt(addForm.period)) ?? null)
    : null

  const editTeacherId = editForm.teacher ? parseInt(editForm.teacher) : null
  const editTeacherSlots = editTeacherId
    ? timetableData.filter((t: any) => t.teacher === editTeacherId || t.teacherId === editTeacherId)
    : []
  const editTeacherBusyOnDay = editForm.day
    ? editTeacherSlots.filter((t: any) => t.day === editForm.day && t.id !== editTarget?.id).map((t: any) => t.period)
    : []
  const editConflict = editTeacherId && editForm.day && editForm.period && editTarget
    ? (editTeacherSlots.find((t: any) => t.day === editForm.day && t.period === parseInt(editForm.period) && t.id !== editTarget.id) ?? null)
    : null

  if (authLoading || !user) return null
  if (!["super_admin", "admin", "teacher"].includes(user.role)) { router.replace("/dashboard"); return null }

  return (
    <>
      <DashboardHeader
        title="Timetable & Academic Calendar"
        description="View and manage class timetables and the school academic calendar"
      />

      <div className="p-6 flex flex-col gap-6">
        <Tabs defaultValue="timetable">
          <TabsList className="w-full max-w-md">
            <TabsTrigger value="timetable" className="flex-1">
              <Clock className="mr-2 h-4 w-4" /> Timetable
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex-1">
              <Calendar className="mr-2 h-4 w-4" /> Academic Calendar
            </TabsTrigger>
          </TabsList>

          {/* ── Timetable Tab ── */}
          <TabsContent value="timetable" className="flex flex-col gap-6 mt-6">
            {/* Controls */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                      <SelectTrigger className="w-44">
                        <GraduationCap className="mr-2 h-4 w-4" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls: any) => (
                          <SelectItem key={cls.id} value={cls.name}>{cls.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Badge variant="secondary" className="text-xs">
                      {classTimetable.length} lessons/week
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Download className="mr-2 h-4 w-4" /> Export PDF
                    </Button>
                    <Dialog open={addSlotOpen} onOpenChange={(o) => { setAddSlotOpen(o); if (!o) { setAddForm({ ...EMPTY_SLOT }); setAddError("") } }}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="mr-2 h-4 w-4" /> Add Slot
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>Add Timetable Slot</DialogTitle>
                          <DialogDescription>Add a new lesson to the timetable for {selectedClass}</DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-4 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                              <Label>Day</Label>
                              <Select value={addForm.day} onValueChange={v => setAddForm({ ...addForm, day: v })}>
                                <SelectTrigger><SelectValue placeholder="Select day" /></SelectTrigger>
                                <SelectContent>
                                  {DAYS.map((day) => (
                                    <SelectItem key={day} value={day}>{day}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Label>Period</Label>
                              <Select value={addForm.period} onValueChange={v => setAddForm({ ...addForm, period: v })}>
                                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent>
                                  {PERIODS.map((p) => (
                                    <SelectItem key={p.period} value={String(p.period)}>Period {p.period} ({p.time})</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>Subject</Label>
                            <Select value={addForm.subject} onValueChange={v => setAddForm({ ...addForm, subject: v })}>
                              <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                              <SelectContent>
                                {subjectsData.filter((s: any) => s.status === "active").map((sub: any) => (
                                  <SelectItem key={sub.id} value={String(sub.id)}>{sub.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>Teacher</Label>
                            <Select value={addForm.teacher} onValueChange={v => setAddForm({ ...addForm, teacher: v })}>
                              <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                              <SelectContent>
                                {teachers.filter((t: any) => t.status === "active").map((t: any) => (
                                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {addTeacherId && addForm.day && (
                            <div className="rounded-md border bg-muted/30 px-3 py-2 flex flex-col gap-1.5">
                              <p className="text-xs font-medium text-card-foreground">
                                {teachers.find((t: any) => t.id === addTeacherId)?.name} — {addForm.day}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {PERIODS.map((p) => {
                                  const busy = addTeacherBusyOnDay.includes(p.period)
                                  const selected = addForm.period === String(p.period)
                                  return (
                                    <span key={p.period} className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                                      busy && selected ? "bg-destructive/10 text-destructive border-destructive/30" :
                                      busy ? "bg-muted text-muted-foreground border-border line-through opacity-60" :
                                      selected ? "bg-primary/10 text-primary border-primary/30" :
                                      "bg-muted/30 text-muted-foreground/70 border-border"
                                    }`}>
                                      P{p.period}
                                    </span>
                                  )
                                })}
                              </div>
                              {addConflict && (
                                <p className="text-xs text-destructive font-medium">
                                  ⚠ Already teaching {addConflict.className || addConflict.class} at this slot
                                </p>
                              )}
                              {!addConflict && addForm.period && (
                                <p className="text-xs text-green-600 dark:text-green-400 font-medium">✓ Teacher is available at this slot</p>
                              )}
                            </div>
                          )}
                          <div className="flex flex-col gap-2">
                            <Label>Room</Label>
                            <Input placeholder="e.g. Block A, Room 101" value={addForm.room} onChange={e => setAddForm({ ...addForm, room: e.target.value })} />
                          </div>
                          {addError && <p className="text-sm text-destructive">{addError}</p>}
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setAddSlotOpen(false)}>Cancel</Button>
                          <Button onClick={handleAdd} disabled={addLoading}>{addLoading ? "Saving..." : "Add Slot"}</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timetable Grid */}
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-28 bg-muted/50">
                        Period / Day
                      </th>
                      {DAYS.map((day) => (
                        <th key={day} className="p-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERIODS.map((period, periodIndex) => (
                      <tr key={period.period} className="border-b border-border last:border-0">
                        <td className="p-3 border-r border-border bg-muted/30">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-card-foreground">Period {period.period}</span>
                            <span className="text-[10px] text-muted-foreground">{period.time}</span>
                          </div>
                        </td>
                        {DAYS.map((day) => {
                          const slot = getTimetableSlot(day, period.period)
                          return (
                            <td key={day} className="p-1.5">
                              {slot ? (
                                <div
                                  className={`rounded-lg border p-2.5 ${PERIOD_COLORS[periodIndex % PERIOD_COLORS.length]} transition-colors hover:opacity-90 cursor-pointer group relative`}
                                  onClick={() => openEdit(slot)}
                                >
                                  <p className="text-xs font-semibold leading-tight">{slot.subjectName || slot.subject}</p>
                                  <p className="text-[10px] mt-1 opacity-80">{(slot.teacherName || slot.teacher || "").split(" ").slice(-1)[0]}</p>
                                  <div className="flex items-center gap-1 mt-1.5">
                                    <MapPin className="h-2.5 w-2.5 opacity-60" />
                                    <span className="text-[9px] opacity-70">{slot.room}</span>
                                  </div>
                                  <button
                                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/20 rounded p-0.5"
                                    onClick={e => { e.stopPropagation(); setDeleteTarget(slot) }}
                                  >
                                    <span className="text-[9px] font-bold">✕</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="rounded-lg border border-dashed border-border p-2.5 text-center min-h-[60px] flex items-center justify-center">
                                  <span className="text-[10px] text-muted-foreground/40">Free</span>
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    {/* Break rows */}
                    <tr className="border-b border-border bg-muted/20">
                      <td colSpan={6} className="p-2 text-center">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          Break Period: 9:30 - 9:45 (after Period 2) | Lunch: 1:00 - 2:00
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Academic Calendar Tab ── */}
          <TabsContent value="calendar" className="flex flex-col gap-6 mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Academic Calendar 2026</CardTitle>
                    <CardDescription>Key dates, events, and examination periods</CardDescription>
                  </div>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" /> Add Event
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Legend */}
                <div className="flex flex-wrap gap-3 mb-6">
                  {[
                    { label: "Term", color: "bg-primary" },
                    { label: "Break", color: "bg-chart-3" },
                    { label: "Examination", color: "bg-destructive" },
                    { label: "School Event", color: "bg-accent" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <div className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>

                {/* Timeline */}
                <div className="flex flex-col gap-0">
                  {calendarEvents.map((event: any, index: number) => (
                    <div key={event.id} className="flex gap-4">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center">
                        <div className={`h-4 w-4 rounded-full border-2 border-card shrink-0 ${
                          event.type === "term" ? "bg-primary" :
                          event.type === "break" ? "bg-chart-3" :
                          event.type === "exam" ? "bg-destructive" : "bg-accent"
                        }`} />
                        {index < calendarEvents.length - 1 && (
                          <div className="w-0.5 flex-1 bg-border min-h-8" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 pb-6">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                          <p className="text-sm font-semibold text-card-foreground">{event.event}</p>
                          <Badge className={`text-[10px] w-fit ${eventTypeColors[event.type]}`}>
                            {event.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(event.date).toLocaleDateString("en-TZ", { weekday: "short", year: "numeric", month: "long", day: "numeric" })}
                          {event.endDate && ` - ${new Date(event.endDate).toLocaleDateString("en-TZ", { weekday: "short", month: "long", day: "numeric" })}`}
                        </p>
                        <p className="text-xs text-muted-foreground/80 mt-0.5">{event.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Slot Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) { setEditTarget(null); setEditError("") } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>Edit Timetable Slot</DialogTitle>
            <DialogDescription>Update this lesson slot</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Day</Label>
                <Select value={editForm.day} onValueChange={v => setEditForm({ ...editForm, day: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((day) => <SelectItem key={day} value={day}>{day}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Period</Label>
                <Select value={editForm.period} onValueChange={v => setEditForm({ ...editForm, period: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODS.map((p) => <SelectItem key={p.period} value={String(p.period)}>Period {p.period} ({p.time})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Subject</Label>
              <Select value={editForm.subject} onValueChange={v => setEditForm({ ...editForm, subject: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {subjectsData.filter((s: any) => s.status === "active").map((sub: any) => (
                    <SelectItem key={sub.id} value={String(sub.id)}>{sub.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Teacher</Label>
              <Select value={editForm.teacher} onValueChange={v => setEditForm({ ...editForm, teacher: v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  {teachers.filter((t: any) => t.status === "active").map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editTeacherId && editForm.day && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 flex flex-col gap-1.5">
                <p className="text-xs font-medium text-card-foreground">
                  {teachers.find((t: any) => t.id === editTeacherId)?.name} — {editForm.day}
                </p>
                <div className="flex flex-wrap gap-1">
                  {PERIODS.map((p) => {
                    const busy = editTeacherBusyOnDay.includes(p.period)
                    const selected = editForm.period === String(p.period)
                    return (
                      <span key={p.period} className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                        busy && selected ? "bg-destructive/10 text-destructive border-destructive/30" :
                        busy ? "bg-muted text-muted-foreground border-border line-through opacity-60" :
                        selected ? "bg-primary/10 text-primary border-primary/30" :
                        "bg-muted/30 text-muted-foreground/70 border-border"
                      }`}>
                        P{p.period}
                      </span>
                    )
                  })}
                </div>
                {editConflict && (
                  <p className="text-xs text-destructive font-medium">
                    ⚠ Already teaching {editConflict.className || editConflict.class} at this slot
                  </p>
                )}
                {!editConflict && editForm.period && (
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">✓ Teacher is available at this slot</p>
                )}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label>Room</Label>
              <Input value={editForm.room} onChange={e => setEditForm({ ...editForm, room: e.target.value })} />
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={editLoading}>{editLoading ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Timetable Slot</DialogTitle>
            <DialogDescription>
              Remove <strong>{deleteTarget?.subjectName || deleteTarget?.subject}</strong> on <strong>{deleteTarget?.day}</strong>, Period {deleteTarget?.period}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>{deleteLoading ? "Removing..." : "Remove"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
