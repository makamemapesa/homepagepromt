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
  Edit,
  Trash2,
  Eye,
  Filter,
  Download,
  GraduationCap,
  Phone,
  Mail,
  Calendar,
  Briefcase,
  Award,
} from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
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


function TeacherDetailDialog({ teacher }: { teacher: any }) {
  return (
    <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
              {String(teacher.name || "").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <DialogTitle style={{ fontFamily: "var(--font-heading)" }} className="text-lg">
              {teacher.name}
            </DialogTitle>
            <DialogDescription>{teacher.qualification} | {teacher.department} Department</DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="flex flex-col gap-5 py-2">
        {/* Status & Quick Info */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Status</span>
            <Badge variant="secondary" className={`text-xs w-fit ${teacher.status === "active" ? "bg-accent/10 text-accent" : teacher.status === "on_leave" ? "bg-warning/10 text-warning-foreground" : "bg-destructive/10 text-destructive"}`}>
              {teacher.status === "on_leave" ? "On Leave" : teacher.status}
            </Badge>
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Experience</span>
            <span className="text-sm font-semibold text-card-foreground">{teacher.yearsOfExperience} years</span>
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Join Date</span>
            <span className="text-sm font-semibold text-card-foreground">{new Date(teacher.joinDate).toLocaleDateString("en-TZ", { year: "numeric", month: "short" })}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Gender</span>
            <span className="text-sm font-semibold text-card-foreground">{teacher.gender}</span>
          </div>
        </div>

        <Separator />

        {/* Contact Info */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contact Information</span>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Email</p>
                <p className="text-sm text-card-foreground">{teacher.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Phone</p>
                <p className="text-sm text-card-foreground">{teacher.phone}</p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Teaching Assignment */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Teaching Assignment</span>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-card-foreground">Subjects: <strong>{(teacher.subject_names || teacher.subjectNames || teacher.subjects || []).join(", ")}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-card-foreground">
                Class Teacher of: <strong>{teacher.class_teacher_of || teacher.classTeacherOf || "Not assigned"}</strong>
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 mt-1">
              <span className="text-[11px] text-muted-foreground">Assigned Classes ({(teacher.assigned_class_names || teacher.assignedClassNames || teacher.assignedClasses || []).length})</span>
            <div className="flex flex-wrap gap-2">
              {(teacher.assigned_class_names || teacher.assignedClassNames || teacher.assignedClasses || []).map((cls: string) => (
                <Badge key={cls} variant="secondary" className="text-xs">{cls}</Badge>
              ))}
            </div>
          </div>
        </div>

        <Separator />

        {/* Salary & Qualification */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Qualification</span>
            <div className="flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-semibold text-card-foreground">{teacher.qualification}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Monthly Salary</span>
            <span className="text-sm font-semibold text-card-foreground">TSh {(teacher.salary ?? 0).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </DialogContent>
  )
}

const EMPTY_TEACHER = {
  name: "", email: "", phone: "", gender: "", qualification: "",
  joinDate: "", department: "", salary: "0", yearsOfExperience: "0",
  status: "active", subjects: [] as number[],
}

export default function TeachersPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()
  useEffect(() => {
    if (!authLoading && user && !["super_admin", "admin"].includes(user.role)) router.replace("/dashboard")
  }, [user, authLoading, router])

  const [searchQuery, setSearchQuery] = useState("")
  const [deptFilter, setDeptFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [viewingTeacher, setViewingTeacher] = useState<any>(null)
  const [teachers, setTeachers] = useState<any[]>([])
  const [subjectsList, setSubjectsList] = useState<any[]>([])

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ ...EMPTY_TEACHER })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState("")

  const [editTarget, setEditTarget] = useState<any>(null)
  const [editForm, setEditForm] = useState({ ...EMPTY_TEACHER })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState("")

  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchTeachers = () => api.get("/api/teachers/").then(r => setTeachers(getResults(r.data))).catch(() => {})

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin"].includes(user.role)) return
    fetchTeachers()
    api.get("/api/subjects/").then(r => setSubjectsList(getResults(r.data))).catch(() => {})
  }, [user, authLoading])

  const buildPayload = (form: typeof EMPTY_TEACHER) => ({
    name: form.name,
    email: form.email,
    phone: form.phone,
    gender: form.gender,
    qualification: form.qualification,
    joinDate: form.joinDate || null,
    department: form.department,
    salary: parseFloat(form.salary) || 0,
    yearsOfExperience: parseInt(form.yearsOfExperience) || 0,
    status: form.status,
    subjects: form.subjects,
  })

  const handleAdd = () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    setAddLoading(true); setAddError("")
    api.post("/api/teachers/", buildPayload(addForm))
      .then(() => { fetchTeachers(); setAddOpen(false); setAddForm({ ...EMPTY_TEACHER }) })
      .catch((e: any) => setAddError(e?.response?.data?.detail || "Failed to add teacher"))
      .finally(() => setAddLoading(false))
  }

  const openEdit = (teacher: any) => {
    setEditForm({
      name: teacher.name || "",
      email: teacher.email || "",
      phone: teacher.phone || "",
      gender: teacher.gender || "",
      qualification: teacher.qualification || "",
      joinDate: teacher.joinDate || "",
      department: teacher.department || "",
      salary: String(teacher.salary ?? 0),
      yearsOfExperience: String(teacher.yearsOfExperience ?? 0),
      status: teacher.status || "active",
      subjects: Array.isArray(teacher.subjects) ? teacher.subjects : [],
    })
    setEditTarget(teacher)
  }

  const handleEdit = () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    setEditLoading(true); setEditError("")
    api.patch(`/api/teachers/${editTarget.id}/`, buildPayload(editForm))
      .then(() => { fetchTeachers(); setEditTarget(null) })
      .catch((e: any) => setEditError(e?.response?.data?.detail || "Failed to update teacher"))
      .finally(() => setEditLoading(false))
  }

  const handleDelete = () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    setDeleteLoading(true)
    api.delete(`/api/teachers/${deleteTarget.id}/`)
      .then(() => { fetchTeachers(); setDeleteTarget(null) })
      .catch(() => {})
      .finally(() => setDeleteLoading(false))
  }

  const toggleSubject = (form: typeof EMPTY_TEACHER, setForm: (f: typeof EMPTY_TEACHER) => void, id: number) => {
    setForm({ ...form, subjects: form.subjects.includes(id) ? form.subjects.filter(s => s !== id) : [...form.subjects, id] })
  }

  const departmentList = Array.from(new Set(teachers.map((t: any) => t.department).filter(Boolean))) as string[]

  const filteredTeachers = teachers.filter((teacher) => {
    const matchesSearch = teacher.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      teacher.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (teacher.subject_names || teacher.subjectNames || teacher.subjects || []).some((s: string) => s.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesDept = deptFilter === "all" || teacher.department === deptFilter
    const matchesStatus = statusFilter === "all" || teacher.status === statusFilter
    return matchesSearch && matchesDept && matchesStatus
  })

  const activeCount = teachers.filter(t => t.status === "active").length
  const onLeaveCount = teachers.filter(t => t.status === "on_leave").length
  const totalSalary = teachers.reduce((sum: number, t: any) => sum + (Number(t.salary) || 0), 0)
  const avgExperience = teachers.length > 0 ? Math.round(teachers.reduce((sum: number, t: any) => sum + (t.yearsOfExperience ?? 0), 0) / teachers.length) : 0

  if (authLoading || !user) return null
  if (!["super_admin", "admin"].includes(user.role)) return null

  return (
    <>
      <DashboardHeader
        title="Teacher Management"
        description="Manage teachers, qualifications, assignments, and departmental allocation"
      />

      <div className="p-6 flex flex-col gap-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-bold text-card-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {teachers.length}
              </p>
              <p className="text-[11px] text-muted-foreground">Total Teachers</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                <GraduationCap className="h-5 w-5 text-accent" />
              </div>
              <p className="text-2xl font-bold text-card-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {activeCount}
              </p>
              <p className="text-[11px] text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
                <Calendar className="h-5 w-5 text-warning-foreground" />
              </div>
              <p className="text-2xl font-bold text-card-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {onLeaveCount}
              </p>
              <p className="text-[11px] text-muted-foreground">On Leave</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-4/10">
                <Award className="h-5 w-5 text-chart-4" />
              </div>
              <p className="text-2xl font-bold text-card-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {avgExperience} yrs
              </p>
              <p className="text-[11px] text-muted-foreground">Avg Experience</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-5/10">
                <Briefcase className="h-5 w-5 text-chart-5" />
              </div>
              <p className="text-2xl font-bold text-card-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {(totalSalary / 1_000_000).toFixed(1)}M
              </p>
              <p className="text-[11px] text-muted-foreground">Monthly Payroll</p>
            </CardContent>
          </Card>
        </div>

        {/* Teachers Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold">All Teachers</CardTitle>
                <CardDescription>View and manage teacher profiles and assignments</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" /> Export
                </Button>
                <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) { setAddForm({ ...EMPTY_TEACHER }); setAddError("") } }}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" /> Add Teacher
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>Add New Teacher</DialogTitle>
                      <DialogDescription>Register a new teacher and set up their profile</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <Label>Full Name</Label>
                          <Input placeholder="Enter full name" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>Gender</Label>
                          <Select value={addForm.gender} onValueChange={v => setAddForm({ ...addForm, gender: v })}>
                            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Male">Male</SelectItem>
                              <SelectItem value="Female">Female</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <Label>Email</Label>
                          <Input type="email" placeholder="Enter email" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>Phone</Label>
                          <Input type="tel" placeholder="+234..." value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <Label>Qualification</Label>
                          <Input placeholder="e.g. M.Sc Physics" value={addForm.qualification} onChange={e => setAddForm({ ...addForm, qualification: e.target.value })} />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>Years of Experience</Label>
                          <Input type="number" placeholder="0" min={0} value={addForm.yearsOfExperience} onChange={e => setAddForm({ ...addForm, yearsOfExperience: e.target.value })} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <Label>Department</Label>
                          <Input placeholder="e.g. Sciences" list="dept-add-list" value={addForm.department} onChange={e => setAddForm({ ...addForm, department: e.target.value })} />
                          <datalist id="dept-add-list">{departmentList.map(d => <option key={d} value={d} />)}</datalist>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>Join Date</Label>
                          <Input type="date" value={addForm.joinDate} onChange={e => setAddForm({ ...addForm, joinDate: e.target.value })} />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Monthly Salary (TSh)</Label>
                        <Input type="number" placeholder="e.g. 250000" value={addForm.salary} onChange={e => setAddForm({ ...addForm, salary: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <Label>Status</Label>
                          <Select value={addForm.status} onValueChange={v => setAddForm({ ...addForm, status: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="on_leave">On Leave</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Subjects Taught</Label>
                        <div className="flex flex-wrap gap-2 rounded-md border border-border p-3">
                          {subjectsList.filter((s: any) => s.status === "active").map((sub: any) => (
                            <label key={sub.id} className="flex items-center gap-1.5 cursor-pointer">
                              <input type="checkbox" checked={addForm.subjects.includes(sub.id)} onChange={() => toggleSubject(addForm, setAddForm, sub.id)} />
                              <span className="text-sm">{sub.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      {addError && <p className="text-sm text-destructive">{addError}</p>}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                      <Button onClick={handleAdd} disabled={addLoading}>{addLoading ? "Saving..." : "Add Teacher"}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or subject..."
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/50">
                    <TableHead className="text-xs font-semibold">Teacher</TableHead>
                    <TableHead className="text-xs font-semibold hidden md:table-cell">Department</TableHead>
                    <TableHead className="text-xs font-semibold">Subject(s)</TableHead>
                    <TableHead className="text-xs font-semibold hidden lg:table-cell">Classes</TableHead>
                    <TableHead className="text-xs font-semibold hidden lg:table-cell">Class Teacher</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeachers.map((teacher) => (
                    <TableRow key={teacher.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                              {String(teacher.name || "").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-card-foreground">{teacher.name}</p>
                            <p className="text-[11px] text-muted-foreground">{teacher.qualification}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm text-card-foreground">{teacher.department}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-card-foreground">{(teacher.subject_names || teacher.subjectNames || teacher.subjects || []).join(", ")}</span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {(teacher.assigned_class_names || teacher.assignedClassNames || teacher.assignedClasses || []).slice(0, 3).map((cls: string) => (
                            <Badge key={cls} variant="secondary" className="text-[10px]">{cls}</Badge>
                          ))}
                          {(teacher.assigned_class_names || teacher.assignedClassNames || teacher.assignedClasses || []).length > 3 && (
                            <Badge variant="secondary" className="text-[10px]">+{(teacher.assigned_class_names || teacher.assignedClassNames || teacher.assignedClasses || []).length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-sm text-muted-foreground">{teacher.class_teacher_of || teacher.classTeacherOf || "-"}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-[11px] ${
                          teacher.status === "active" ? "bg-accent/10 text-accent"
                          : teacher.status === "on_leave" ? "bg-warning/10 text-warning-foreground"
                          : "bg-destructive/10 text-destructive"
                        }`}>
                          {teacher.status === "on_leave" ? "On Leave" : teacher.status}
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
                            <DropdownMenuItem onClick={() => setViewingTeacher(teacher)}>
                              <Eye className="mr-2 h-4 w-4" /> View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(teacher)}>
                              <Edit className="mr-2 h-4 w-4" /> Edit Teacher
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(teacher)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Remove Teacher
                            </DropdownMenuItem>
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
                Showing {filteredTeachers.length} of {teachers.length} teachers
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Detail Dialog */}
      <Dialog open={!!viewingTeacher} onOpenChange={(open) => !open && setViewingTeacher(null)}>
        {viewingTeacher && <TeacherDetailDialog teacher={viewingTeacher} />}
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) { setEditTarget(null); setEditError("") } }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>Edit Teacher</DialogTitle>
            <DialogDescription>Update teacher information</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Full Name</Label>
                <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Gender</Label>
                <Select value={editForm.gender} onValueChange={v => setEditForm({ ...editForm, gender: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Email</Label>
                <Input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Phone</Label>
                <Input type="tel" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Qualification</Label>
                <Input value={editForm.qualification} onChange={e => setEditForm({ ...editForm, qualification: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Years of Experience</Label>
                <Input type="number" min={0} value={editForm.yearsOfExperience} onChange={e => setEditForm({ ...editForm, yearsOfExperience: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Department</Label>
                <Input list="dept-edit-list" value={editForm.department} onChange={e => setEditForm({ ...editForm, department: e.target.value })} />
                <datalist id="dept-edit-list">{departmentList.map(d => <option key={d} value={d} />)}</datalist>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Join Date</Label>
                <Input type="date" value={editForm.joinDate} onChange={e => setEditForm({ ...editForm, joinDate: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Monthly Salary (TSh)</Label>
              <Input type="number" value={editForm.salary} onChange={e => setEditForm({ ...editForm, salary: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={v => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Subjects Taught</Label>
              <div className="flex flex-wrap gap-2 rounded-md border border-border p-3">
                {subjectsList.filter((s: any) => s.status === "active").map((sub: any) => (
                  <label key={sub.id} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={editForm.subjects.includes(sub.id)} onChange={() => toggleSubject(editForm, setEditForm, sub.id)} />
                    <span className="text-sm">{sub.name}</span>
                  </label>
                ))}
              </div>
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
            <DialogTitle>Remove Teacher</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
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
