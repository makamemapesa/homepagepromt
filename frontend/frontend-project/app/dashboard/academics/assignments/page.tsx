"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { api, getResults } from "@/lib/api-client"
import {
  Search, Plus, Edit, Trash2, UserCheck, BookOpen, Users, Building2, CheckCircle2,
} from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

export default function AssignmentsPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()
  useEffect(() => {
    if (!authLoading && user && !["super_admin", "admin"].includes(user.role)) router.replace("/dashboard")
  }, [user, authLoading, router])

  const [assignments, setAssignments] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [teachersExtended, setTeachersExtended] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [deptFilter, setDeptFilter] = useState("all")
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<any>(null)
  const [form, setForm] = useState({ class: "", subject: "", teacherId: "" })
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState("")

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin"].includes(user.role)) return
    api.get("/api/teacher-assignments/").then(r => setAssignments(getResults(r.data))).catch(() => {})
    api.get("/api/classes/").then(r => setClasses(getResults(r.data))).catch(() => {})
    api.get("/api/subjects/").then(r => setSubjects(getResults(r.data))).catch(() => {})
    api.get("/api/teachers/").then(r => setTeachersExtended(getResults(r.data))).catch(() => {})
  }, [user, authLoading])

  const departments = Array.from(new Set(teachersExtended.map((t) => t.department).filter(Boolean)))

  const filtered = assignments.filter((a) => {
    const q = search.toLowerCase()
    const teacherName = a.teacherName || a.teacher || ""
    const subjectName = a.subjectName || a.subject || ""
    const className = a.className || a.class || ""
    return (
      (teacherName.toLowerCase().includes(q) || subjectName.toLowerCase().includes(q) || className.toLowerCase().includes(q)) &&
      (deptFilter === "all" || a.department === deptFilter)
    )
  })

  const openAdd = () => { setEditTarget(null); setForm({ class: "", subject: "", teacherId: "" }); setSaveError(""); setOpen(true) }
  const openEdit = (a: any) => {
    setEditTarget(a)
    setForm({ class: String(a.studentClass), subject: String(a.subject), teacherId: String(a.teacher || "") })
    setSaveError("")
    setOpen(true)
  }
  const handleSave = () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    const teacher = teachersExtended.find((t) => String(t.id) === form.teacherId)
    const payload = { student_class: form.class, subject: form.subject, teacher: form.teacherId }
    setSaveLoading(true); setSaveError("")
    if (editTarget) {
      api.patch(`/api/teacher-assignments/${editTarget.id}/`, payload)
        .then(r => {
          setAssignments((prev) => prev.map((a) => a.id === editTarget.id
            ? { ...a, ...r.data, teacherName: teacher?.name, className: form.class, subjectName: form.subject }
            : a))
          setOpen(false)
        })
        .catch(() => setSaveError("Failed to save assignment."))
        .finally(() => setSaveLoading(false))
    } else {
      api.post("/api/teacher-assignments/", payload)
        .then(r => { setAssignments((prev) => [...prev, r.data]); setOpen(false) })
        .catch(() => setSaveError("Failed to create assignment."))
        .finally(() => setSaveLoading(false))
    }
  }
  const handleDelete = (id: string | number) => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    api.delete(`/api/teacher-assignments/${id}/`)
      .then(() => setAssignments((prev) => prev.filter((a) => a.id !== id)))
      .catch(() => {})
  }

  const depCounts = departments.map((d) => ({ dept: d, count: assignments.filter((a) => a.department === d).length }))

  if (authLoading || !user) return null
  if (!["super_admin", "admin"].includes(user.role)) return null

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <DashboardHeader title="Teacher Assignments" description="Manage subject and class assignments for all teachers." />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Assignments", value: assignments.length, icon: CheckCircle2, color: "text-primary", bg: "bg-primary/10" },
          { label: "Teachers Assigned", value: new Set(assignments.map((a) => a.teacherId)).size, icon: UserCheck, color: "text-accent", bg: "bg-accent/10" },
          { label: "Classes Covered", value: new Set(assignments.map((a) => a.className)).size, icon: Users, color: "text-blue-600", bg: "bg-blue-500/10" },
          { label: "Departments", value: departments.length, icon: Building2, color: "text-purple-600", bg: "bg-purple-500/10" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className={`rounded-lg p-2 ${bg}`}><Icon className={`h-5 w-5 ${color}`} /></div>
              <div><p className="text-2xl font-bold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Department breakdown */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {depCounts.map(({ dept, count }) => (
          <Card key={dept} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setDeptFilter(dept === deptFilter ? "all" : dept)}>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xl font-bold">{count}</p>
              <p className="text-xs text-muted-foreground mt-1">{dept}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Assignment List</CardTitle>
              <CardDescription>All active teacher-subject-class assignments</CardDescription>
            </div>
            <Button size="sm" className="gap-1" onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add Assignment
            </Button>
          </div>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search teacher, subject, class..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teacher</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="hidden sm:table-cell">Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {(a.teacherName || a.teacher || "").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{a.teacherName || a.teacher}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      {a.subjectName || a.subject}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{a.className || a.class}</Badge></TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary">{a.department}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">Active</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(a.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Assignment" : "New Assignment"}</DialogTitle>
            <DialogDescription>Assign a teacher to a subject and class.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Class</Label>
              <Select value={form.class} onValueChange={(v) => setForm((f) => ({ ...f, class: v }))}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Subject</Label>
              <Select value={form.subject} onValueChange={(v) => setForm((f) => ({ ...f, subject: v }))}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>{subjects.filter((s) => s.status === "active").map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Teacher</Label>
              <Select value={form.teacherId} onValueChange={(v) => setForm((f) => ({ ...f, teacherId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>{teachersExtended.filter((t) => t.status === "active").map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {saveError && <p className="text-xs text-destructive px-1">{saveError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saveLoading}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.class || !form.subject || !form.teacherId || saveLoading}>
              {saveLoading ? "Saving..." : editTarget ? "Save Changes" : "Create Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
