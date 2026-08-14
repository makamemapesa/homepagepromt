"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import {
  Search, Plus, MoreHorizontal, Download, Filter,
  Eye, Edit, Trash2, X, User, Calendar, BookOpen,
  Heart, Gift, GraduationCap, FileText, Upload, ExternalLink, CheckCircle2, History,
} from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { api, getResults } from "@/lib/api-client"
import { exportCSV } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"

export default function StudentsPage() {
  const { user, loading: authLoading } = useUser()
  const [searchQuery, setSearchQuery] = useState("")
  const [classFilter, setClassFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<any[]>([])

  // View dialog
  const [viewOpen, setViewOpen] = useState(false)
  const [viewStudent, setViewStudent] = useState<any>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [viewError, setViewError] = useState("")
  const [docUploading, setDocUploading] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteStudent, setDeleteStudent] = useState<any>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  const fetchStudents = () => {
    setLoading(true)
    api.get("/api/students/?page_size=500")
      .then(r => setStudents(getResults(r.data)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (authLoading || !user) return
    fetchStudents()
    api.get("/api/classes/").then(r => setClasses(getResults(r.data))).catch(() => {})
  }, [user, authLoading])

  const getName = (s: any) =>
    s.fullName || [s.firstName, s.lastName].filter(Boolean).join(" ") || "Unknown"

  const filteredStudents = students.filter((s) => {
    const name = getName(s)
    const cls = s.className || ""
    const reg = s.regNo || ""
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesClass = classFilter === "all" || cls === classFilter
    const matchesStatus = statusFilter === "all" || s.status === statusFilter
    return matchesSearch && matchesClass && matchesStatus
  })

  const uniqueClasses = Array.from(new Set(students.map((s) => s.className || "").filter(Boolean))).sort() as string[]

  const openView = (s: any) => {
    setViewStudent(s)
    setViewOpen(true)
    setViewLoading(true)
    setViewError("")
    api.get(`/api/students/${s.id}/`)
      .then(r => setViewStudent(r.data))
      .catch(() => setViewError("Failed to load student details."))
      .finally(() => setViewLoading(false))
  }

  const handleDocUpload = async (docType: string, file: File) => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    if (!viewStudent) return
    setDocUploading(docType)
    setUploadError(null)
    const fd = new FormData()
    fd.append("document_type", docType)
    fd.append("file", file)
    try {
      const r = await api.post(`/api/students/${viewStudent.id}/upload_document/`, fd)
      setViewStudent((prev: any) => ({
        ...prev,
        documents: [
          ...(prev.documents || []).filter((d: any) => d.documentType !== docType),
          r.data,
        ],
      }))
    } catch {
      setUploadError("Upload failed. Please try again.")
    }
    finally { setDocUploading(null) }
  }

  // Edit — navigate to dedicated edit page
  const isAdminRole = user?.role === "super_admin" || user?.role === "admin"
  const router = useRouter()
   const openEdit = (s: any) => {
    if (user?.role === "staff") return // Staff cannot edit student details
    router.push(`/dashboard/students/edit/${s.id}`)
  }

  const openDelete = (s: any) => { setDeleteStudent(s); setDeleteOpen(true) }

  const handleDeleteStudent = async () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    if (!deleteStudent) return
    setDeleteLoading(true)
    setDeleteError("")
    try {
      await api.delete(`/api/students/${deleteStudent.id}/`)
      setDeleteOpen(false)
      fetchStudents()
    } catch {
      setDeleteError("Failed to remove student. Please try again.")
    } finally {
      setDeleteLoading(false)
    }
  }

  if (authLoading || !user) return null

  return (
    <>
      <DashboardHeader
        title="Student Management"
        description="View and manage all student records and information"
      />
      <div className="p-6 flex flex-col gap-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Total Students", value: students.length, color: "bg-primary/10 text-primary" },
            { label: "Active",  value: students.filter(s => s.status === "active").length, color: "bg-accent/10 text-accent" },
            { label: "Suspended", value: students.filter(s => s.status === "suspended").length, color: "bg-destructive/10 text-destructive" },
            { label: "Graduated", value: students.filter(s => s.status === "graduated").length, color: "bg-chart-3/10 text-chart-3" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold text-card-foreground mt-1" style={{ fontFamily: "var(--font-heading)" }}>{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Student Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold">All Students</CardTitle>
                <CardDescription>Comprehensive list of all enrolled students</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => exportCSV(filteredStudents, "students.csv")}>
                  <Download className="mr-2 h-4 w-4" /> Export
                </Button>
                {user?.role === "super_admin" && (
                  <Link href="/dashboard/students/import">
                    <Button size="sm" variant="outline"><Upload className="mr-2 h-4 w-4" /> Import Students</Button>
                  </Link>
                )}
                {isAdminRole && (
                  <Link href="/dashboard/students/register">
                    <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Register Student</Button>
                  </Link>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or registration number..."
                  className="pl-9 pr-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="w-36">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {uniqueClasses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="graduated">Graduated</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/50">
                    <TableHead className="text-xs font-semibold">Student</TableHead>
                    <TableHead className="text-xs font-semibold">Reg. No.</TableHead>
                    <TableHead className="text-xs font-semibold">Class</TableHead>
                    <TableHead className="text-xs font-semibold hidden md:table-cell">Fee Status</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">Loading students...</TableCell></TableRow>
                  ) : filteredStudents.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">No students found.</TableCell></TableRow>
                  ) : filteredStudents.map((student) => {
                    const displayName = getName(student)
                    const feeStatus = student.feeStatus || "unpaid"
                    return (
                      <TableRow key={student.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 ring-1 ring-border">
                              {student.passportPhotoUrl && <AvatarImage src={student.passportPhotoUrl} alt={displayName} className="object-cover" />}
                              <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary/40 text-primary-foreground text-xs font-bold">
                                {displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm font-medium text-card-foreground">{displayName}</span>
                              {student.lastMovementType === "repetition" && (
                                <span className="text-[10px] font-semibold text-orange-600 bg-orange-100 dark:bg-orange-950/40 dark:text-orange-400 rounded px-1.5 py-0.5 w-fit">Repeating</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground font-mono text-xs">{student.regNo || ""}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-[11px]">{student.className || ""}</Badge></TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="secondary" className={`text-[11px] ${feeStatus === "paid" ? "bg-accent/10 text-accent" : feeStatus === "partial" ? "bg-yellow-500/10 text-yellow-700" : "bg-destructive/10 text-destructive"}`}>
                            {feeStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`text-[11px] ${student.status === "active" ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"}`}>
                            {student.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openView(student)}>
                                <Eye className="mr-2 h-4 w-4" /> View Profile
                              </DropdownMenuItem>
                              {isAdminRole && (
                                <DropdownMenuItem onClick={() => openEdit(student)}>
                                  <Edit className="mr-2 h-4 w-4" /> Edit Details
                                </DropdownMenuItem>
                              )}
                              {isAdminRole && <DropdownMenuSeparator />}
                              {isAdminRole && (
                                <DropdownMenuItem className="text-destructive" onClick={() => openDelete(student)}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Remove Student
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">{filteredStudents.length} of {students.length} students</p>
          </CardContent>
        </Card>
      </div>

      {/* View Student Dialog */}
      <Dialog open={viewOpen} onOpenChange={(o) => { setViewOpen(o); if (!o) { setViewError(""); setUploadError(null) } }}>
        <DialogContent className="w-[90vw] sm:w-[90vw] sm:max-w-[1100px] h-[85vh] overflow-hidden p-0 gap-0 [&>button]:hidden">
          <DialogTitle className="sr-only">Student Profile</DialogTitle>
          {viewLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-sm text-muted-foreground gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                <User className="h-6 w-6 text-primary" />
              </div>
              Loading student profile...
            </div>
          ) : viewError ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-sm text-destructive">
              <p>{viewError}</p>
              <Button variant="outline" size="sm" onClick={() => viewStudent && openView(viewStudent)}>Retry</Button>
            </div>
          ) : viewStudent && (() => {
            const vName = getName(viewStudent)
            const p = viewStudent.parent || null
            const passportDoc = viewStudent.documents?.find((d: any) => d.documentType === "passport_photo")
            const photoUrl = passportDoc?.file || viewStudent.passportPhotoUrl || null
            const initials = vName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
            const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"
            const val = (v: any) => (v !== null && v !== undefined && v !== "") ? String(v) : "—"

            const InfoField = ({ label, value }: { label: string; value: any }) => (
              <div className="flex flex-col gap-0.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="text-sm font-medium text-foreground">{val(value) === "—" ? <span className="text-muted-foreground/40">—</span> : val(value)}</p>
              </div>
            )

            return (
              <div className="flex flex-col h-full">
                {/* Banner with full profile header inside */}
                <div className="relative bg-gradient-to-r from-primary via-primary/90 to-primary/60 px-8 pt-5 pb-6 flex-shrink-0">
                  {/* Top-right actions with gap */}
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <Button size="sm" className="bg-white/15 hover:bg-white/25 text-white border border-white/30 shadow-none" onClick={() => { setViewOpen(false); openEdit(viewStudent) }}>
                      <Edit className="mr-2 h-3.5 w-3.5" /> Edit Profile
                    </Button>
                    <button
                      onClick={() => setViewOpen(false)}
                      className="h-8 w-8 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-6">
                    <Avatar className="h-32 w-32 border-4 border-white/30 shadow-2xl flex-shrink-0">
                      {photoUrl && <AvatarImage src={photoUrl} alt={vName} className="object-cover" />}
                      <AvatarFallback className="bg-white/20 text-white text-3xl font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 pr-40">
                      <h2 className="text-2xl font-bold text-white leading-tight" style={{ fontFamily: "var(--font-heading)" }}>{vName}</h2>
                      <p className="text-sm text-white/75 font-mono mt-0.5">{viewStudent.regNo || "—"}</p>
                      <p className="text-base text-white/85 mt-0.5 font-medium">
                        {viewStudent.className || "—"}{viewStudent.studentType ? ` · ${viewStudent.studentType}` : ""}
                      </p>
                      <div className="flex gap-2 mt-2.5 flex-wrap">
                        <Badge className={`text-[11px] font-semibold border-0 ${
                          viewStudent.status === "active" ? "bg-white/20 text-white"
                          : viewStudent.status === "suspended" ? "bg-red-400/30 text-white"
                          : "bg-white/15 text-white/80"
                        }`}>{viewStudent.status || "—"}</Badge>
                        <Badge className={`text-[11px] font-semibold border-0 ${
                          viewStudent.feeStatus === "paid" ? "bg-white/20 text-white"
                          : viewStudent.feeStatus === "partial" ? "bg-yellow-300/30 text-white"
                          : "bg-red-400/30 text-white"
                        }`}>{viewStudent.feeStatus || "—"} fees</Badge>
                      {/* Repeating badge */}
                        {viewStudent.isOrphan && (
                          <Badge className="text-[11px] font-semibold border-0 bg-purple-400/30 text-white">Orphan</Badge>
                        )}
                        {(() => {
                          const hist = viewStudent.academicHistory || []
                          const latest = hist[0]
                          return latest?.movementType === "repetition" ? (
                            <Badge className="text-[11px] font-semibold border-0 bg-orange-400/40 text-white">Repeating</Badge>
                          ) : latest?.movementType === "stream_change" ? (
                            <Badge className="text-[11px] font-semibold border-0 bg-blue-400/30 text-white">Stream Change</Badge>
                          ) : null
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="px-6 pb-6 pt-4 flex-1 overflow-y-auto">
                  <Tabs defaultValue="personal">
                    <TabsList className="w-full mb-5">
                      <TabsTrigger value="personal" className="flex-1 gap-1.5"><User className="h-3.5 w-3.5" />Personal</TabsTrigger>
                      <TabsTrigger value="academic" className="flex-1 gap-1.5"><GraduationCap className="h-3.5 w-3.5" />Academic</TabsTrigger>
                      <TabsTrigger value="guardian" className="flex-1 gap-1.5"><Heart className="h-3.5 w-3.5" />Parent / Guardian</TabsTrigger>
                      <TabsTrigger value="sponsor" className="flex-1 gap-1.5"><Gift className="h-3.5 w-3.5" />Sponsor</TabsTrigger>
                      <TabsTrigger value="history" className="flex-1 gap-1.5"><History className="h-3.5 w-3.5" />History</TabsTrigger>
                      <TabsTrigger value="documents" className="flex-1 gap-1.5"><FileText className="h-3.5 w-3.5" />Documents</TabsTrigger>
                    </TabsList>

                    <TabsContent value="personal">
                      <div className="bg-muted/30 rounded-xl p-5 grid grid-cols-3 gap-x-8 gap-y-5">
                        <InfoField label="First Name" value={viewStudent.firstName} />
                        <InfoField label="Middle Name" value={viewStudent.middleName} />
                        <InfoField label="Last Name" value={viewStudent.lastName} />
                        <InfoField label="Date of Birth" value={fmtDate(viewStudent.dateOfBirth)} />
                        <InfoField label="Gender" value={viewStudent.gender} />
                        <InfoField label="Blood Group" value={viewStudent.bloodGroup} />
                        <InfoField label="Religion" value={viewStudent.religion} />
                        <InfoField label="State of Origin" value={viewStudent.stateOfOrigin} />
                        <InfoField label="Nationality" value={viewStudent.nationality} />
                      </div>
                      {viewStudent.residentialAddress && (
                        <div className="mt-3 bg-muted/30 rounded-xl px-5 py-4">
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Residential Address</p>
                          <p className="text-sm font-medium">{viewStudent.residentialAddress}</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="academic">
                      <div className="bg-muted/30 rounded-xl p-5 grid grid-cols-3 gap-x-8 gap-y-5">
                        <InfoField label="Class" value={viewStudent.className} />
                        <InfoField label="Student Type" value={viewStudent.studentType} />
                        <InfoField label="Academic Session" value={viewStudent.academicSession} />
                        <InfoField label="Admission Date" value={fmtDate(viewStudent.admissionDate)} />
                        <InfoField label="Previous School" value={viewStudent.previousSchool} />
                        <InfoField label="Previous Class" value={viewStudent.previousClass} />
                      </div>
                    </TabsContent>

                    <TabsContent value="history">
                      {(() => {
                        const hist: any[] = viewStudent.academicHistory || []
                        const MOVEMENT_STYLE: Record<string, string> = {
                          promotion:     "bg-accent/10 text-accent border-accent/30",
                          stream_change: "bg-blue-500/10 text-blue-700 border-blue-400/30",
                          repetition:    "bg-orange-500/10 text-orange-700 border-orange-400/30",
                          demotion:      "bg-destructive/10 text-destructive border-destructive/30",
                        }
                        const MOVEMENT_LABEL: Record<string, string> = {
                          promotion:     "Promoted",
                          stream_change: "Stream Change",
                          repetition:    "Repeating",
                          demotion:      "Demoted",
                        }
                        if (hist.length === 0) return (
                          <div className="bg-muted/30 rounded-xl px-5 py-10 flex flex-col items-center justify-center text-center gap-2">
                            <History className="h-8 w-8 text-muted-foreground/30" />
                            <p className="text-sm text-muted-foreground">No movement history recorded yet.</p>
                            <p className="text-xs text-muted-foreground/60">History is recorded when a student is promoted, moves class, or repeats a year.</p>
                          </div>
                        )
                        return (
                          <div className="flex flex-col gap-3">
                            {hist.map((h: any, i: number) => {
                              const mtype = h.movementType || h.movement_type || "promotion"
                              const style = MOVEMENT_STYLE[mtype] || MOVEMENT_STYLE.promotion
                              const label = MOVEMENT_LABEL[mtype] || mtype
                              const isRepeat = mtype === "repetition"
                              return (
                                <div key={i} className={`rounded-xl border p-4 ${isRepeat ? "border-orange-300/50 bg-orange-50/30 dark:bg-orange-950/10" : "border-border bg-muted/20"}`}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-semibold text-foreground">
                                          {h.term} · {h.academicSession || h.academic_session}
                                        </span>
                                        <Badge variant="outline" className={`text-[11px] font-semibold ${style}`}>{label}</Badge>
                                        {isRepeat && <Badge variant="outline" className="text-[11px] font-semibold bg-orange-500/10 text-orange-700 border-orange-400/30">Year Repeated</Badge>}
                                      </div>
                                      {(h.previousClass || h.newClass) && (
                                        <p className="text-xs text-muted-foreground">
                                          {h.previousClass || h.previous_class
                                            ? <><span className="font-medium text-foreground/70">{h.previousClass || h.previous_class}</span> → </>
                                            : null
                                          }
                                          <span className="font-medium text-foreground/70">{h.newClass || h.new_class || "—"}</span>
                                        </p>
                                      )}
                                      {h.reason && <p className="text-xs text-muted-foreground italic">Reason: {h.reason}</p>}
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                      {Number(h.average) > 0 && (
                                        <p className="text-base font-bold text-foreground">{Number(h.average).toFixed(1)}%</p>
                                      )}
                                      {h.grade && <p className="text-xs text-muted-foreground">{h.grade}{h.division ? ` · Div ${h.division}` : ""}</p>}
                                      {h.position > 0 && <p className="text-xs text-muted-foreground">Position {h.position}</p>}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </TabsContent>

                    <TabsContent value="guardian">
                      {p ? (
                        <div className="bg-muted/30 rounded-xl p-5 grid grid-cols-3 gap-x-8 gap-y-5">
                          <InfoField label="Full Name" value={p.fullName} />
                          <InfoField label="Relationship" value={p.relationship} />
                          <InfoField label="Phone" value={p.phone} />
                          <InfoField label="Email" value={p.email} />
                          <InfoField label="Occupation" value={p.occupation} />
                          <InfoField label="Emergency Contact" value={p.emergencyContactName} />
                          <InfoField label="Emergency Phone" value={p.emergencyContactPhone} />
                          <InfoField label="Office Address" value={p.officeAddress} />
                          <InfoField label="Home Address" value={p.homeAddress} />
                        </div>
                      ) : (
                        <div className="bg-muted/30 rounded-xl px-5 py-10 flex flex-col items-center justify-center text-center gap-2">
                          <Heart className="h-8 w-8 text-muted-foreground/30" />
                          <p className="text-sm text-muted-foreground">No parent/guardian information recorded.</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="sponsor">
                      {(viewStudent.donorName || viewStudent.donorNumber) ? (
                        <div className="bg-muted/30 rounded-xl p-5 grid grid-cols-3 gap-x-8 gap-y-5">
                          <InfoField label="Donor Name" value={viewStudent.donorName} />
                          <InfoField label="Sponsor Number" value={viewStudent.donorNumber} />
                        </div>
                      ) : (
                        <div className="bg-muted/30 rounded-xl px-5 py-10 flex flex-col items-center justify-center text-center gap-2">
                          <Gift className="h-8 w-8 text-muted-foreground/30" />
                          <p className="text-sm text-muted-foreground">No sponsor or donor assigned.</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="documents">
                      {(() => {
                        const DOC_TYPES = [
                          { key: "passport_photo",       label: "Passport Photo",          icon: "🖼️" },
                          { key: "birth_certificate",    label: "Birth Certificate",        icon: "📄" },
                          { key: "previous_report",      label: "Previous School Report",   icon: "📋" },
                          { key: "transfer_certificate", label: "Transfer Certificate",     icon: "📝" },
                          { key: "medical_certificate",  label: "Medical Certificate",      icon: "🏥" },
                          { key: "other",                label: "Other Document",           icon: "📎" },
                        ]
                        const docs = viewStudent.documents || []
                        return (
                          <div className="grid grid-cols-3 gap-4">
                            {uploadError && (
                              <div className="col-span-3 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                                {uploadError}
                              </div>
                            )}
                            {DOC_TYPES.map(({ key, label, icon }) => {
                              const uploaded = docs.filter((d: any) => d.documentType === key)
                              const latest = uploaded[uploaded.length - 1] || null
                              const isUploading = docUploading === key
                              return (
                                <div key={key} className={`rounded-xl border-2 p-4 flex flex-col gap-3 transition-colors ${latest ? "border-accent/30 bg-accent/5" : "border-dashed border-border bg-muted/20"}`}>
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="text-lg leading-none">{icon}</p>
                                      <p className="text-sm font-semibold mt-1.5">{label}</p>
                                    </div>
                                    {latest && <CheckCircle2 className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />}
                                  </div>
                                  {latest ? (
                                    <div className="flex flex-col gap-1.5">
                                      <p className="text-[11px] text-muted-foreground">
                                        Uploaded {new Date(latest.uploadedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                      </p>
                                      <a href={latest.fileUrl || latest.file} target="_blank" rel="noopener noreferrer" className="w-full">
                                        <Button variant="outline" size="sm" className="w-full gap-1.5 h-7 text-xs">
                                          <ExternalLink className="h-3 w-3" /> View / Download
                                        </Button>
                                      </a>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground italic">Not uploaded</p>
                                  )}
                                  <label className="w-full cursor-pointer">
                                    <input
                                      type="file"
                                      className="hidden"
                                      accept="image/*,.pdf,.doc,.docx"
                                      disabled={isUploading}
                                      onChange={(e) => {
                                        const f = e.target.files?.[0]
                                        if (f) handleDocUpload(key, f)
                                        e.target.value = ""
                                      }}
                                    />
                                    <div className={`flex items-center justify-center gap-1.5 h-8 text-xs w-full rounded-md border px-3 transition-colors ${
                                      isUploading
                                        ? "border-border bg-muted text-muted-foreground cursor-not-allowed"
                                        : latest
                                        ? "border-border bg-background hover:bg-accent hover:text-accent-foreground"
                                        : "border-border bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                                    }`}>
                                      {isUploading
                                        ? <><Upload className="h-3 w-3 animate-bounce" /> Uploading...</>
                                        : <><Upload className="h-3 w-3" /> {latest ? "Replace" : "Upload"}</>
                                      }
                                    </div>
                                  </label>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Delete Student Dialog */}
      <Dialog open={deleteOpen} onOpenChange={(o) => { setDeleteOpen(o); if (!o) setDeleteError("") }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>Remove Student</DialogTitle>
            <DialogDescription>
              Permanently remove <strong>{deleteStudent ? getName(deleteStudent) : ""}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-sm text-destructive px-1">{deleteError}</p>}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteLoading}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteStudent} disabled={deleteLoading}>
              {deleteLoading ? "Removing..." : "Remove Student"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}