"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { api, getResults } from "@/lib/api-client"
import {
  Search,
  Plus,
  MoreHorizontal,
  BookOpen,
  Edit,
  Trash2,
  Eye,
  Filter,
  Download,
  GraduationCap,
  Users,
  Layers,
  CheckCircle,
  XCircle,
} from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
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
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"


function SubjectDetailDialog({ subject }: { subject: any }) {
  return (
    <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-base font-bold text-primary">
            {subject.code}
          </div>
          <div>
            <DialogTitle style={{ fontFamily: "var(--font-heading)" }} className="text-lg">
              {subject.name}
            </DialogTitle>
            <DialogDescription>{subject.department} Department</DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="flex flex-col gap-4 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Type</span>
            <span className="text-sm font-semibold text-card-foreground capitalize">{subject.type}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Credit Units</span>
            <span className="text-sm font-semibold text-card-foreground">{subject.credit_units ?? subject.creditUnits}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Status</span>
            <Badge variant="secondary" className={`text-xs w-fit ${subject.status === "active" ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"}`}>
              {subject.status}
            </Badge>
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Classes</span>
            <span className="text-sm font-semibold text-card-foreground">{(subject.classes_offered || subject.classesOffered || []).length} levels</span>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</span>
          <p className="text-sm text-card-foreground leading-relaxed">{subject.description}</p>
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Teachers Assigned ({(subject.teacher_names || subject.teacherNames || subject.teachers || []).length})
          </span>
          {(subject.teacher_names || subject.teacherNames || subject.teachers || []).map((teacher: string) => (
            <div key={teacher} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {teacher.split(" ").map((n) => n[0]).join("")}
              </div>
              <span className="text-sm font-medium text-card-foreground">{teacher}</span>
            </div>
          ))}
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Classes Offered</span>
          <div className="flex flex-wrap gap-2">
            {(subject.classes_offered || subject.classesOffered || []).map((cls: string) => (
              <Badge key={cls} variant="secondary" className="text-xs">{cls}</Badge>
            ))}
          </div>
        </div>
      </div>
    </DialogContent>
  )
}

const EMPTY_SUBJ = { name: "", code: "", department: "", type: "core", creditUnits: "2", description: "", classesOffered: [] as string[], status: "active" }

function SubjectFormFields({ form, setForm, error, levels, departmentList, toggleLevel }: {
  form: any
  setForm: any
  error: string
  levels: string[]
  departmentList: string[]
  toggleLevel: (form: any, setForm: any, level: string) => void
}) {
  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label>Subject Name *</Label>
          <Input placeholder="e.g. Mathematics" value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Subject Code *</Label>
          <Input placeholder="e.g. MTH" value={form.code} onChange={e => setForm((f: any) => ({ ...f, code: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label>Department *</Label>
          <Input placeholder="e.g. Sciences" value={form.department} onChange={e => setForm((f: any) => ({ ...f, department: e.target.value }))} list="dept-list" />
          <datalist id="dept-list">
            {departmentList.map(d => <option key={d} value={d} />)}
          </datalist>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Type</Label>
          <Select value={form.type} onValueChange={v => setForm((f: any) => ({ ...f, type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="core">Core</SelectItem>
              <SelectItem value="elective">Elective</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label>Credit Units</Label>
          <Input type="number" min={1} max={6} value={form.creditUnits} onChange={e => setForm((f: any) => ({ ...f, creditUnits: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => setForm((f: any) => ({ ...f, status: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label>Description</Label>
        <Textarea placeholder="Brief description..." rows={2} value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Classes Offered</Label>
        {levels.length === 0 ? (
          <p className="text-xs text-muted-foreground">No classes found. Add classes first in Academics → Classes.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {levels.map((level) => (
              <label key={level} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={form.classesOffered.includes(level)} onCheckedChange={() => toggleLevel(form, setForm, level)} />
                {level}
              </label>
            ))}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export default function SubjectsPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()
  // Writes are admin-only server-side; without this the buttons render for
  // teachers and then silently do nothing when clicked.
  const isAdmin = !!user && ["super_admin", "admin"].includes(user.role)
  const [searchQuery, setSearchQuery] = useState("")
  const [deptFilter, setDeptFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [subjectsList, setSubjectsList] = useState<any[]>([])
  const [classesList, setClassesList] = useState<any[]>([])
  const [viewingSubject, setViewingSubject] = useState<any>(null)

  // Add
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ ...EMPTY_SUBJ, classesOffered: [] as string[] })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState("")

  // Edit
  const [editTarget, setEditTarget] = useState<any>(null)
  const [editForm, setEditForm] = useState({ ...EMPTY_SUBJ, classesOffered: [] as string[] })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState("")

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchSubjects = () => {
    api.get("/api/subjects/").then(r => setSubjectsList(getResults(r.data))).catch(() => {})
  }

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin", "teacher"].includes(user.role)) return
    fetchSubjects()
    api.get("/api/classes/").then(r => setClassesList(getResults(r.data))).catch(() => {})
  }, [user, authLoading])

  // Unique levels from actual classes in DB, preserving natural order
  const levelOptions = Array.from(
    new Map(classesList.map((c: any) => [c.level, c.level])).values()
  ) as string[]

  const departmentList = Array.from(new Set(subjectsList.map((s: any) => s.department).filter(Boolean))) as string[]

  const filteredSubjects = subjectsList.filter((subject) => {
    const matchesSearch = subject.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      subject.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      subject.department.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesDept = deptFilter === "all" || subject.department === deptFilter
    const matchesType = typeFilter === "all" || subject.type === typeFilter
    return matchesSearch && matchesDept && matchesType
  })

  const coreCount = subjectsList.filter((s) => s.type === "core").length
  const electiveCount = subjectsList.filter((s) => s.type === "elective").length
  const activeCount = subjectsList.filter((s) => s.status === "active").length

  const toggleLevel = (form: any, setForm: any, level: string) => {
    setForm((f: any) => ({
      ...f,
      classesOffered: f.classesOffered.includes(level)
        ? f.classesOffered.filter((l: string) => l !== level)
        : [...f.classesOffered, level],
    }))
  }

  const buildSubjPayload = (form: typeof EMPTY_SUBJ) => ({
    name: form.name,
    code: form.code,
    department: form.department,
    type: form.type,
    creditUnits: Number(form.creditUnits) || 2,
    description: form.description,
    classesOffered: form.classesOffered,
    status: form.status,
  })

  const handleCreate = async () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    setAddError("")
    if (!addForm.name || !addForm.code || !addForm.department) { setAddError("Name, code, and department are required."); return }
    setAddLoading(true)
    try {
      await api.post("/api/subjects/", buildSubjPayload(addForm))
      setAddOpen(false)
      setAddForm({ ...EMPTY_SUBJ, classesOffered: [] })
      fetchSubjects()
    } catch (e: any) {
      const d = e?.response?.data
      setAddError(d && typeof d === "object" ? Object.values(d).flat().join(" ") : "Failed to create subject.")
    } finally { setAddLoading(false) }
  }

  const openEdit = (subj: any) => {
    setEditForm({
      name: subj.name || "",
      code: subj.code || "",
      department: subj.department || "",
      type: subj.type || "core",
      creditUnits: String(subj.creditUnits ?? subj.credit_units ?? 2),
      description: subj.description || "",
      classesOffered: subj.classesOffered || subj.classes_offered || [],
      status: subj.status || "active",
    })
    setEditError("")
    setEditTarget(subj)
  }

  const handleEdit = async () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    if (!editTarget) return
    setEditError("")
    if (!editForm.name || !editForm.code || !editForm.department) { setEditError("Name, code, and department are required."); return }
    setEditLoading(true)
    try {
      await api.patch(`/api/subjects/${editTarget.id}/`, buildSubjPayload(editForm))
      setEditTarget(null)
      fetchSubjects()
    } catch (e: any) {
      const d = e?.response?.data
      setEditError(d && typeof d === "object" ? Object.values(d).flat().join(" ") : "Failed to update subject.")
    } finally { setEditLoading(false) }
  }

  const handleDelete = async () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await api.delete(`/api/subjects/${deleteTarget.id}/`)
      setDeleteTarget(null)
      fetchSubjects()
    } catch { setDeleteTarget(null) }
    finally { setDeleteLoading(false) }
  }

  if (authLoading || !user) return null
  if (!["super_admin", "admin", "teacher"].includes(user.role)) { router.replace("/dashboard"); return null }

  return (
    <>
      <DashboardHeader
        title="Subjects Management"
        description="Manage all academic subjects, departments, and curriculum allocation"
      />

      <div className="p-6 flex flex-col gap-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-bold text-card-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {subjectsList.length}
              </p>
              <p className="text-[11px] text-muted-foreground">Total Subjects</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                <CheckCircle className="h-5 w-5 text-accent" />
              </div>
              <p className="text-2xl font-bold text-card-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {coreCount}
              </p>
              <p className="text-[11px] text-muted-foreground">Core Subjects</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-3/10">
                <Layers className="h-5 w-5 text-chart-3" />
              </div>
              <p className="text-2xl font-bold text-card-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {electiveCount}
              </p>
              <p className="text-[11px] text-muted-foreground">Elective Subjects</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-4/10">
                <Layers className="h-5 w-5 text-chart-4" />
              </div>
              <p className="text-2xl font-bold text-card-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {departmentList.length}
              </p>
              <p className="text-[11px] text-muted-foreground">Departments</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-5/10">
                <GraduationCap className="h-5 w-5 text-chart-5" />
              </div>
              <p className="text-2xl font-bold text-card-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {activeCount}
              </p>
              <p className="text-[11px] text-muted-foreground">Active Subjects</p>
            </CardContent>
          </Card>
        </div>

        {/* Department Overview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Departments Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {departmentList.map((dept) => {
                const subjectCount = subjectsList.filter((s: any) => s.department === dept).length
                return (
                <div key={dept} className="flex items-start gap-3 rounded-lg border border-border p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary shrink-0">
                    {dept.substring(0, 3).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-card-foreground">{dept}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-muted-foreground">
                        <BookOpen className="inline h-3 w-3 mr-1" />{subjectCount} subjects
                      </span>
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Subjects Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold">All Subjects</CardTitle>
                <CardDescription>Manage subject details, teacher assignments, and class allocations</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" /> Export
                </Button>
                {isAdmin && (
                <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) { setAddForm({ ...EMPTY_SUBJ, classesOffered: [] }); setAddError("") } }}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={() => setAddOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" /> Add Subject
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>Add New Subject</DialogTitle>
                      <DialogDescription>Create a new academic subject</DialogDescription>
                    </DialogHeader>
                    <SubjectFormFields form={addForm} setForm={setAddForm} error={addError} levels={levelOptions} departmentList={departmentList} toggleLevel={toggleLevel} />
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                      <Button onClick={handleCreate} disabled={addLoading}>{addLoading ? "Creating..." : "Create Subject"}</Button>
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
                  placeholder="Search by subject name, code, or department..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-44">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departmentList.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="core">Core</SelectItem>
                  <SelectItem value="elective">Elective</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/50">
                    <TableHead className="text-xs font-semibold">Subject</TableHead>
                    <TableHead className="text-xs font-semibold">Department</TableHead>
                    <TableHead className="text-xs font-semibold hidden md:table-cell">Type</TableHead>
                    <TableHead className="text-xs font-semibold hidden lg:table-cell">Credit</TableHead>
                    <TableHead className="text-xs font-semibold hidden md:table-cell">Teacher(s)</TableHead>
                    <TableHead className="text-xs font-semibold hidden lg:table-cell">Classes</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubjects.map((subject) => (
                    <TableRow key={subject.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-[10px] font-bold text-primary">
                            {subject.code}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-card-foreground">{subject.name}</p>
                            <p className="text-[11px] text-muted-foreground line-clamp-1 max-w-48">{subject.description}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-card-foreground">{subject.department}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="secondary" className={`text-[11px] capitalize ${subject.type === "core" ? "bg-primary/10 text-primary" : "bg-chart-3/10 text-chart-3"}`}>
                          {subject.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-sm font-medium text-card-foreground">{subject.credit_units ?? subject.creditUnits}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">{(subject.teacher_names || subject.teachers || []).join(", ")}</span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-sm text-muted-foreground">{(subject.classes_offered || subject.classesOffered || []).length} levels</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-[11px] ${subject.status === "active" ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"}`}>
                          {subject.status}
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
                            <DropdownMenuItem onClick={() => setViewingSubject(subject)}>
                              <Eye className="mr-2 h-4 w-4" /> View Details
                            </DropdownMenuItem>
                            {isAdmin && (
                              <>
                                <DropdownMenuItem onClick={() => openEdit(subject)}>
                                  <Edit className="mr-2 h-4 w-4" /> Edit Subject
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(subject)}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete Subject
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

            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                Showing {filteredSubjects.length} of {subjectsList.length} subjects
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Detail Dialog */}
      <Dialog open={!!viewingSubject} onOpenChange={(open) => !open && setViewingSubject(null)}>
        {viewingSubject && <SubjectDetailDialog subject={viewingSubject} />}
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) { setEditTarget(null); setEditError("") } }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>Edit Subject</DialogTitle>
            <DialogDescription>Update details for <strong>{editTarget?.name}</strong></DialogDescription>
          </DialogHeader>
          <SubjectFormFields form={editForm} setForm={setEditForm} error={editError} levels={levelOptions} departmentList={departmentList} toggleLevel={toggleLevel} />
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
            <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>Delete Subject</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? "Deleting..." : "Delete Subject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
