"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { api, getResults } from "@/lib/api-client"
import {
  Search,
  Plus,
  MoreHorizontal,
  Users,
  BookOpen,
  MapPin,
  Edit,
  Trash2,
  Eye,
  GraduationCap,
  BarChart3,
  Filter,
  Download,
  ArrowUpDown,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"


function ClassDetailDialog({ cls }: { cls: any }) {
  return (
    <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle style={{ fontFamily: "var(--font-heading)" }} className="text-lg">
          {cls.name} - Class Details
        </DialogTitle>
        <DialogDescription>
          Complete information about this class
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-5 py-2">
        {/* Class Info Summary */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Section", value: cls.section },
            { label: "Room", value: cls.room },
            { label: "Capacity", value: `${cls.student_count ?? cls.studentCount ?? cls.students ?? 0}/${cls.capacity}` },
            { label: "Status", value: cls.status },
          ].map((item) => (
            <div key={item.label} className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{item.label}</span>
              <span className="text-sm font-semibold text-card-foreground">{item.value}</span>
            </div>
          ))}
        </div>

        {/* Capacity Progress */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-card-foreground">Capacity Utilization</span>
            <span className="text-sm text-muted-foreground">{cls.capacity ? Math.round(((cls.student_count ?? cls.studentCount ?? cls.students ?? 0) / cls.capacity) * 100) : 0}%</span>
          </div>
          <Progress value={cls.capacity ? ((cls.student_count ?? cls.studentCount ?? cls.students ?? 0) / cls.capacity) * 100 : 0} className="h-2.5" />
        </div>

        <Separator />

        {/* Class Teacher */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Class Teacher</span>
          <div className="flex items-center gap-3 rounded-lg border border-border p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
              {(cls.class_teacher_name || cls.classTeacherName || cls.classTeacher || "").split(" ").map((n: string) => n[0]).join("")}
            </div>
            <div>
              <p className="text-sm font-medium text-card-foreground">{cls.class_teacher_name || cls.classTeacherName || cls.classTeacher}</p>
              <p className="text-xs text-muted-foreground">Class Teacher</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Subjects */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Subjects Offered ({(cls.subject_names || cls.subjectNames || cls.subjects || []).length})
          </span>
          <div className="flex flex-wrap gap-2">
            {(cls.subject_names || cls.subjectNames || cls.subjects || []).map((subject: string) => (
              <Badge key={subject} variant="secondary" className="text-xs">
                {subject}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </DialogContent>
  )
}

const EMPTY_FORM = {
  level: "", arm: "", section: "", capacity: "40", room: "", classTeacher: "",
  status: "active",
  // A class with no subjects cannot be marked: Marks Entry offers only the
  // subjects attached here, so leaving this out made every new class a dead end.
  subjects: [] as number[],
}

const SECTIONS = ["Nursery", "Primary", "Secondary"]
const SECTION_COLORS = [
  { bg: "bg-chart-3/10", text: "text-chart-3" },
  { bg: "bg-chart-4/10", text: "text-chart-4" },
  { bg: "bg-primary/10", text: "text-primary" },
  { bg: "bg-accent/10",  text: "text-accent"  },
  { bg: "bg-chart-5/10", text: "text-chart-5" },
]
const LEVEL_SUGGESTIONS = ["Nursery 1","Nursery 2","Std 1","Std 2","Std 3","Std 4","Std 5","Std 6","Std 7","Form 1","Form 2","Form 3","Form 4"]
const ARM_SUGGESTIONS = ["A","B","C","D","E","F","G","H"]

export default function ClassesPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()
  // Writes are admin-only server-side; without this the buttons render for
  // teachers and then silently do nothing when clicked.
  const isAdmin = !!user && ["super_admin", "admin"].includes(user.role)
  const [searchQuery, setSearchQuery] = useState("")
  const [sectionFilter, setSectionFilter] = useState("all")
  const [classes, setClasses] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])

  // Add
  const [addOpen, setAddOpen] = useState(false)
  const [subjectsList, setSubjectsList] = useState<any[]>([])
  const [addForm, setAddForm] = useState({ ...EMPTY_FORM })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState("")

  // Edit
  const [editTarget, setEditTarget] = useState<any>(null)
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState("")

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // View
  const [viewingClass, setViewingClass] = useState<any>(null)

  // Sections management
  const [sections, setSections] = useState<string[]>(() => {
    try { const s = localStorage.getItem("school-sections"); return s ? JSON.parse(s) : [...SECTIONS] } catch { return [...SECTIONS] }
  })
  const persistSections = (next: string[]) => { setSections(next); try { localStorage.setItem("school-sections", JSON.stringify(next)) } catch {} }
  const [sectionAddOpen, setSectionAddOpen] = useState(false)
  const [sectionAddValue, setSectionAddValue] = useState("")
  const [sectionEditTarget, setSectionEditTarget] = useState<string | null>(null)
  const [sectionEditValue, setSectionEditValue] = useState("")
  const [sectionDeleteTarget, setSectionDeleteTarget] = useState<string | null>(null)

  const fetchClasses = () => {
    api.get("/api/classes/").then(r => setClasses(getResults(r.data))).catch(() => {})
  }

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin", "teacher"].includes(user.role)) return
    fetchClasses()
    api.get("/api/teachers/").then(r => setTeachers(getResults(r.data))).catch(() => {})
    api.get("/api/subjects/?page_size=500")
      .then(r => setSubjectsList(getResults(r.data)))
      .catch(() => setSubjectsList([]))
  }, [user, authLoading])

  const buildPayload = (form: typeof EMPTY_FORM) => {
    const level = form.level
    const arm = form.arm
    const lvl = level.toUpperCase()
    const section = form.section || (
      lvl.includes("NURSERY") ? "Nursery" :
      (lvl.includes("STD") || lvl.includes("STANDARD") || lvl.includes("PRIMARY")) ? "Primary" :
      "Secondary"
    )
    const name = `${level}${arm}`
    return {
      name,
      level,
      arm,
      section,
      capacity: Number(form.capacity) || 40,
      room: form.room,
      classTeacher: (form.classTeacher && form.classTeacher !== "none") ? Number(form.classTeacher) : null,
      status: form.status,
      subjects: form.subjects,
    }
  }

  const handleCreate = async () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    setAddError("")
    if (!addForm.level || !addForm.arm) { setAddError("Level and Arm are required."); return }
    setAddLoading(true)
    try {
      await api.post("/api/classes/", buildPayload(addForm))
      setAddOpen(false)
      setAddForm({ ...EMPTY_FORM })
      fetchClasses()
    } catch (e: any) {
      const d = e?.response?.data
      setAddError(d && typeof d === "object" ? Object.values(d).flat().join(" ") : "Failed to create class.")
    } finally { setAddLoading(false) }
  }

  const openEdit = (cls: any) => {
    setEditForm({
      level: cls.level || "",
      arm: cls.arm || "",
      section: cls.section || "",
      capacity: String(cls.capacity ?? 40),
      room: cls.room || "",
      classTeacher: cls.classTeacher ? String(cls.classTeacher) : "none",
      status: cls.status || "active",
      subjects: (cls.subjects || []).map((id: any) => Number(id)),
    })
    setEditError("")
    setEditTarget(cls)
  }

  const handleEdit = async () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    if (!editTarget) return
    setEditError("")
    if (!editForm.level || !editForm.arm) { setEditError("Level and Arm are required."); return }
    setEditLoading(true)
    try {
      await api.patch(`/api/classes/${editTarget.id}/`, buildPayload(editForm))
      setEditTarget(null)
      fetchClasses()
    } catch (e: any) {
      const d = e?.response?.data
      setEditError(d && typeof d === "object" ? Object.values(d).flat().join(" ") : "Failed to update class.")
    } finally { setEditLoading(false) }
  }

  const handleDelete = async () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await api.delete(`/api/classes/${deleteTarget.id}/`)
      setDeleteTarget(null)
      fetchClasses()
    } catch { setDeleteTarget(null) }
    finally { setDeleteLoading(false) }
  }

  const filteredClasses = classes.filter((cls) => {
    const matchesSearch = cls.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cls.class_teacher_name || cls.classTeacherName || cls.classTeacher || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      cls.room.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesSection = sectionFilter === "all" || cls.section.toLowerCase() === sectionFilter
    return matchesSearch && matchesSection
  })

  const totalStudents = classes.reduce((sum, c) => sum + (c.student_count ?? c.studentCount ?? c.students ?? 0), 0)
  const totalCapacity = classes.reduce((sum, c) => sum + (c.capacity ?? 0), 0)
  const nurseryClasses = classes.filter((c) => c.section === "Nursery")
  const primaryClasses = classes.filter((c) => c.section === "Primary")
  const secondaryClasses = classes.filter((c) => c.section === "Secondary")

  if (authLoading || !user) return null
  if (!["super_admin", "admin", "teacher"].includes(user.role)) { router.replace("/dashboard"); return null }

  return (
    <>
      <DashboardHeader
        title="Classes Management"
        description="Manage all classes, sections, arms, and room assignments"
      />

      <div className="p-6 flex flex-col gap-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 xl:grid-cols-6">
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-bold text-card-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {classes.length}
              </p>
              <p className="text-[11px] text-muted-foreground">Total Classes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                <Users className="h-5 w-5 text-accent" />
              </div>
              <p className="text-2xl font-bold text-card-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {totalStudents.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">Total Students</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-3/10">
                <GraduationCap className="h-5 w-5 text-chart-3" />
              </div>
              <p className="text-2xl font-bold text-card-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {nurseryClasses.length}
              </p>
              <p className="text-[11px] text-muted-foreground">Nursery Classes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-4/10">
                <GraduationCap className="h-5 w-5 text-chart-4" />
              </div>
              <p className="text-2xl font-bold text-card-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {primaryClasses.length}
              </p>
              <p className="text-[11px] text-muted-foreground">Primary Classes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-bold text-card-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {secondaryClasses.length}
              </p>
              <p className="text-[11px] text-muted-foreground">Secondary Classes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-5/10">
                <BarChart3 className="h-5 w-5 text-chart-5" />
              </div>
              <p className="text-2xl font-bold text-card-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {Math.round((totalStudents / totalCapacity) * 100)}%
              </p>
              <p className="text-[11px] text-muted-foreground">Capacity Used</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs: Capacity Overview | Sections | All Classes */}
        <Tabs defaultValue="classes">
          <TabsList className="mb-4">
            <TabsTrigger value="classes">All Classes</TabsTrigger>
            <TabsTrigger value="capacity">Capacity Overview</TabsTrigger>
            <TabsTrigger value="sections">Sections</TabsTrigger>
          </TabsList>

          {/* ─── Capacity Overview Tab ─── */}
          <TabsContent value="capacity">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Class Capacity Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {classes.map((cls) => {
                const studentCount = cls.student_count ?? cls.studentCount ?? cls.students ?? 0
                const percentage = cls.capacity ? Math.round((studentCount / cls.capacity) * 100) : 0
                return (
                  <div key={cls.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-card-foreground">{cls.name}</span>
                        <span className="text-xs text-muted-foreground">{cls.student_count ?? cls.studentCount ?? cls.students ?? 0}/{cls.capacity}</span>
                      </div>
                      <Progress
                        value={percentage}
                        className={`h-1.5 ${percentage > 90 ? "[&>div]:bg-destructive" : percentage > 75 ? "[&>div]:bg-warning" : ""}`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          {/* ─── Sections Tab ─── */}
          <TabsContent value="sections">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Sections</CardTitle>
                    <CardDescription>Manage school sections used to group classes</CardDescription>
                  </div>
                  {isAdmin && (
                    <Button size="sm" onClick={() => { setSectionAddValue(""); setSectionAddOpen(true) }}>
                      <Plus className="mr-2 h-4 w-4" /> Add Section
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {sections.map((section, idx) => {
                    const color = SECTION_COLORS[idx % SECTION_COLORS.length]
                    const sectionClasses = classes.filter(c => c.section === section)
                    const sectionStudents = sectionClasses.reduce((sum, c) => sum + (c.student_count ?? c.studentCount ?? c.students ?? 0), 0)
                    return (
                      <div key={section} className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color.bg}`}>
                            <GraduationCap className={`h-5 w-5 ${color.text}`} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-card-foreground">{section}</p>
                            <p className="text-xs text-muted-foreground">{sectionClasses.length} classes &middot; {sectionStudents} students</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`${color.bg} ${color.text} border-0 text-[11px]`}>{sectionClasses.length} classes</Badge>
                          {isAdmin && (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSectionEditTarget(section); setSectionEditValue(section) }}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setSectionDeleteTarget(section)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {sections.length === 0 && (
                    <div className="py-12 text-center text-sm text-muted-foreground">No sections yet. Click &ldquo;Add Section&rdquo; to create one.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── All Classes Tab ─── */}
          <TabsContent value="classes">
        {/* Classes Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold">All Classes</CardTitle>
                <CardDescription>Manage class details, teachers, and assignments</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" /> Export
                </Button>
                {isAdmin && (
                <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) { setAddForm({ ...EMPTY_FORM }); setAddError("") } }}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={() => setAddOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" /> Add Class
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>Add New Class</DialogTitle>
                      <DialogDescription>Create a new class with room and teacher assignment</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <Label>Level *</Label>
                          <Input
                            placeholder="e.g. JSS 1, Form 1, Grade 7"
                            list="add-level-list"
                            value={addForm.level}
                            onChange={e => setAddForm(f => ({ ...f, level: e.target.value }))}
                          />
                          <datalist id="add-level-list">
                            {LEVEL_SUGGESTIONS.map(l => <option key={l} value={l} />)}
                          </datalist>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>Arm *</Label>
                          <Input
                            placeholder="e.g. A, B, E, Gold"
                            list="add-arm-list"
                            value={addForm.arm}
                            onChange={e => setAddForm(f => ({ ...f, arm: e.target.value }))}
                          />
                          <datalist id="add-arm-list">
                            {ARM_SUGGESTIONS.map(a => <option key={a} value={a} />)}
                          </datalist>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Section</Label>
                        <Select value={addForm.section} onValueChange={v => setAddForm(f => ({ ...f, section: v }))}>
                          <SelectTrigger><SelectValue placeholder="Auto-detected from level" /></SelectTrigger>
                          <SelectContent>
                          {sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">Leave blank to auto-detect from level name</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Capacity</Label>
                        <Input type="number" min={1} value={addForm.capacity} onChange={e => setAddForm(f => ({ ...f, capacity: e.target.value }))} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Room / Location</Label>
                        <Input placeholder="e.g. Block A, Room 101" value={addForm.room} onChange={e => setAddForm(f => ({ ...f, room: e.target.value }))} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Class Teacher</Label>
                        <Select value={addForm.classTeacher} onValueChange={v => setAddForm(f => ({ ...f, classTeacher: v }))}>
                          <SelectTrigger><SelectValue placeholder="Assign a class teacher" /></SelectTrigger>
                          <SelectContent>
                            {teachers.filter((t: any) => t.status === "active").map((t: any) => (
                              <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>
                          Subjects Offered
                          <span className="ml-1 font-normal text-muted-foreground">
                            ({addForm.subjects.length} selected)
                          </span>
                        </Label>
                        {/* Marks Entry offers only the subjects attached here, so a
                            class saved with none cannot be marked at all. */}
                        {addForm.subjects.length === 0 && (
                          <p className="text-xs text-yellow-700">
                            Pick at least one, or this class cannot be used for Marks Entry.
                          </p>
                        )}
                        <div className="grid max-h-44 grid-cols-2 gap-1.5 overflow-y-auto rounded-md border p-2">
                          {subjectsList.filter((s: any) => s.status === "active").map((s: any) => {
                            const on = addForm.subjects.includes(Number(s.id))
                            return (
                              <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted/50">
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={() => setAddForm((f: any) => ({
                                    ...f,
                                    subjects: on
                                      ? f.subjects.filter((id: number) => id !== Number(s.id))
                                      : [...f.subjects, Number(s.id)],
                                  }))}
                                />
                                <span className="truncate">{s.name}</span>
                              </label>
                            )
                          })}
                          {subjectsList.filter((s: any) => s.status === "active").length === 0 && (
                            <p className="col-span-2 text-xs text-muted-foreground">
                              No active subjects exist yet. Create them under Academics &rarr; Subjects first.
                            </p>
                          )}
                        </div>
                      </div>
                      {addError && <p className="text-xs text-destructive">{addError}</p>}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                      <Button onClick={handleCreate} disabled={addLoading}>{addLoading ? "Creating..." : "Create Class"}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by class name, teacher, or room..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={sectionFilter} onValueChange={setSectionFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {sections.map(s => <SelectItem key={s} value={s.toLowerCase()}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/50">
                    <TableHead className="text-xs font-semibold">Class</TableHead>
                    <TableHead className="text-xs font-semibold">Section</TableHead>
                    <TableHead className="text-xs font-semibold hidden md:table-cell">Class Teacher</TableHead>
                    <TableHead className="text-xs font-semibold hidden lg:table-cell">Room</TableHead>
                    <TableHead className="text-xs font-semibold">Students</TableHead>
                    <TableHead className="text-xs font-semibold hidden md:table-cell">Subjects</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClasses.map((cls) => (
                    <TableRow key={cls.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                            {cls.arm}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-card-foreground">{cls.name}</p>
                            <p className="text-[11px] text-muted-foreground">{cls.level}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-[11px] ${
                          SECTION_COLORS[sections.indexOf(cls.section) >= 0 ? sections.indexOf(cls.section) % SECTION_COLORS.length : 0].bg
                        } ${
                          SECTION_COLORS[sections.indexOf(cls.section) >= 0 ? sections.indexOf(cls.section) % SECTION_COLORS.length : 0].text
                        } border-0`}>
                          {cls.section}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm text-card-foreground">{cls.class_teacher_name || cls.classTeacherName || cls.classTeacher || "—"}</span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          {cls.room}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-card-foreground">{cls.student_count ?? cls.studentCount ?? cls.students ?? 0}</span>
                          <span className="text-xs text-muted-foreground">/ {cls.capacity}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">{(cls.subject_names || cls.subjectNames || cls.subjects || []).length} subjects</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[11px] bg-accent/10 text-accent">
                          {cls.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewingClass(cls)}>
                              <Eye className="mr-2 h-4 w-4" /> View Details
                            </DropdownMenuItem>
                            {isAdmin && (
                              <>
                                <DropdownMenuItem onClick={() => openEdit(cls)}>
                                  <Edit className="mr-2 h-4 w-4" /> Edit Class
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(cls)}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete Class
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                Showing {filteredClasses.length} of {classes.length} classes
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled className="text-xs">Previous</Button>
                <Button variant="outline" size="sm" className="text-xs bg-primary text-primary-foreground">1</Button>
                <Button variant="outline" size="sm" className="text-xs">Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* View Detail Dialog */}
      <Dialog open={!!viewingClass} onOpenChange={(open) => !open && setViewingClass(null)}>
        {viewingClass && <ClassDetailDialog cls={viewingClass} />}
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) { setEditTarget(null); setEditError("") } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>Edit Class</DialogTitle>
            <DialogDescription>Update details for <strong>{editTarget?.name}</strong></DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Level *</Label>
                <Input
                  list="edit-level-list"
                  value={editForm.level}
                  onChange={e => setEditForm(f => ({ ...f, level: e.target.value }))}
                />
                <datalist id="edit-level-list">
                  {LEVEL_SUGGESTIONS.map(l => <option key={l} value={l} />)}
                </datalist>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Arm *</Label>
                <Input
                  list="edit-arm-list"
                  value={editForm.arm}
                  onChange={e => setEditForm(f => ({ ...f, arm: e.target.value }))}
                />
                <datalist id="edit-arm-list">
                  {ARM_SUGGESTIONS.map(a => <option key={a} value={a} />)}
                </datalist>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Section</Label>
              <Select value={editForm.section} onValueChange={v => setEditForm(f => ({ ...f, section: v }))}>
                <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                <SelectContent>
                  {sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Capacity</Label>
              <Input type="number" min={1} value={editForm.capacity} onChange={e => setEditForm(f => ({ ...f, capacity: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Room / Location</Label>
              <Input value={editForm.room} onChange={e => setEditForm(f => ({ ...f, room: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>
                Subjects Offered
                <span className="ml-1 font-normal text-muted-foreground">
                  ({editForm.subjects.length} selected)
                </span>
              </Label>
              {/* Marks Entry offers only the subjects attached here, so a
                  class saved with none cannot be marked at all. */}
              {editForm.subjects.length === 0 && (
                <p className="text-xs text-yellow-700">
                  Pick at least one, or this class cannot be used for Marks Entry.
                </p>
              )}
              <div className="grid max-h-44 grid-cols-2 gap-1.5 overflow-y-auto rounded-md border p-2">
                {subjectsList.filter((s: any) => s.status === "active").map((s: any) => {
                  const on = editForm.subjects.includes(Number(s.id))
                  return (
                    <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setEditForm((f: any) => ({
                          ...f,
                          subjects: on
                            ? f.subjects.filter((id: number) => id !== Number(s.id))
                            : [...f.subjects, Number(s.id)],
                        }))}
                      />
                      <span className="truncate">{s.name}</span>
                    </label>
                  )
                })}
                {subjectsList.filter((s: any) => s.status === "active").length === 0 && (
                  <p className="col-span-2 text-xs text-muted-foreground">
                    No active subjects exist yet. Create them under Academics &rarr; Subjects first.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Class Teacher</Label>
              <Select value={editForm.classTeacher || "none"} onValueChange={v => setEditForm(f => ({ ...f, classTeacher: v }))}>
                <SelectTrigger><SelectValue placeholder="Assign a class teacher" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {teachers.filter((t: any) => t.status === "active").map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editError && <p className="text-xs text-destructive">{editError}</p>}
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
            <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>Delete Class</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? "Deleting..." : "Delete Class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Section Dialog */}
      <Dialog open={sectionAddOpen} onOpenChange={o => { if (!o) setSectionAddOpen(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>Add Section</DialogTitle>
            <DialogDescription>Create a new section for grouping classes</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Section Name *</Label>
              <Input placeholder="e.g. Evening, Special Needs..." value={sectionAddValue} onChange={e => setSectionAddValue(e.target.value)} />
              {sections.includes(sectionAddValue.trim()) && <p className="text-xs text-destructive">A section with this name already exists.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionAddOpen(false)}>Cancel</Button>
            <Button
              disabled={!sectionAddValue.trim() || sections.includes(sectionAddValue.trim())}
              onClick={() => { persistSections([...sections, sectionAddValue.trim()]); setSectionAddOpen(false) }}
            >Add Section</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Section Dialog */}
      <Dialog open={!!sectionEditTarget} onOpenChange={o => { if (!o) setSectionEditTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>Edit Section</DialogTitle>
            <DialogDescription>Rename <strong>{sectionEditTarget}</strong>. Classes currently assigned to this section will keep their existing value.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Section Name *</Label>
              <Input value={sectionEditValue} onChange={e => setSectionEditValue(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionEditTarget(null)}>Cancel</Button>
            <Button
              disabled={!sectionEditValue.trim()}
              onClick={() => { persistSections(sections.map(s => s === sectionEditTarget ? sectionEditValue.trim() : s)); setSectionEditTarget(null) }}
            >Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Section Dialog */}
      <Dialog open={!!sectionDeleteTarget} onOpenChange={o => { if (!o) setSectionDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>Delete Section</DialogTitle>
            <DialogDescription>
              Remove section <strong>{sectionDeleteTarget}</strong>? Existing classes assigned to it will not be affected, but the section will no longer appear in dropdowns.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setSectionDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { persistSections(sections.filter(s => s !== sectionDeleteTarget)); setSectionDeleteTarget(null) }}>
              Delete Section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
