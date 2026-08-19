"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { api, getResults } from "@/lib/api-client"
import { exportCSV } from "@/lib/utils"
import {
  ArrowUpCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Search,
  Download,
  Users,
  GraduationCap,
  TrendingUp,
  Award,
} from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"

// Movement types supported
const MOVEMENT_TYPES = [
  { value: "promotion",     label: "Promotion",     desc: "Move up to the next class" },
  { value: "stream_change", label: "Stream Change",  desc: "Same level, different section (e.g. Form 1A → Form 1B)" },
  { value: "repetition",   label: "Repetition",    desc: "Repeat the same class (fail / attendance)" },
  { value: "demotion",     label: "Demotion",       desc: "Move down a class (school/parent decision)" },
]

const statusConfig = {
  eligible:   { label: "Eligible",   color: "bg-accent/15 text-accent border-accent/30",               icon: CheckCircle2,    iconColor: "text-accent" },
  review:     { label: "Under Review", color: "bg-yellow-500/15 text-yellow-700 border-yellow-400/30", icon: AlertTriangle,   iconColor: "text-yellow-500" },
  repeat:     { label: "Repeat Year", color: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle,       iconColor: "text-destructive" },
  graduated:  { label: "Graduated",  color: "bg-primary/15 text-primary border-primary/30",            icon: GraduationCap,  iconColor: "text-primary" },
}

const gradeColor = (grade: string) => {
  if (grade.startsWith("A")) return "text-accent font-semibold"
  if (grade.startsWith("B")) return "text-blue-600 font-semibold"
  if (grade.startsWith("C")) return "text-yellow-600 font-semibold"
  if (grade.startsWith("D")) return "text-orange-600 font-semibold"
  return "text-destructive font-semibold"
}

export default function PromotionsPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()
  useEffect(() => {
    if (!authLoading && user && !["super_admin", "admin"].includes(user.role)) router.replace("/dashboard")
  }, [user, authLoading, router])

  const [promotionStudents, setPromotionStudents] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [classFilter, setClassFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [selectedNextClassId, setSelectedNextClassId] = useState("")
  const [selectedMovementType, setSelectedMovementType] = useState("promotion")
  const [movementReason, setMovementReason] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)
  const [promoted, setPromoted] = useState<(string | number)[]>([])
  const [promoting, setPromoting] = useState(false)
  const [bulkPromoting, setBulkPromoting] = useState(false)

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin"].includes(user.role)) return
    api.get("/api/classes/").then(r => setClasses(getResults(r.data))).catch(() => {})
    loadStudents()
  }, [user, authLoading])

  const loadStudents = () => {
    api.get("/api/students/?page_size=500").then(r => {
      const students = getResults(r.data)
      setPromotionStudents(students.map((s: any) => {
        const className = s.className || ""
        const feeStatus = s.feeStatus || "unknown"
        const status = s.status === "graduated" ? "graduated"
          : s.status === "suspended" ? "repeat"
          : feeStatus === "paid" ? "eligible"
          : "review"
        return {
          id: String(s.id),
          name: s.fullName || [s.firstName, s.lastName].filter(Boolean).join(" ") || "Unknown",
          regNo: s.regNo || "",
          currentClass: className,
          currentClassId: s.studentClass,
          average: 0,
          grade: "—",
          division: "—",
          attendance: 0,
          feeStatus,
          status,
        }
      }))
    }).catch(() => {})
  }

  const filtered = promotionStudents.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.regNo.toLowerCase().includes(searchQuery.toLowerCase())
    const matchClass  = classFilter === "all"  || s.currentClass === classFilter
    const matchStatus = statusFilter === "all" || s.status === statusFilter
    return matchSearch && matchClass && matchStatus
  })

  const eligible   = promotionStudents.filter((s) => s.status === "eligible").length
  const review     = promotionStudents.filter((s) => s.status === "review").length
  const repeat     = promotionStudents.filter((s) => s.status === "repeat").length
  const graduated  = promotionStudents.filter((s) => s.status === "graduated").length
  const total      = promotionStudents.length
  const promotionRate = total > 0 ? Math.round(((eligible + graduated) / total) * 100) : 0

  // Students with no class assigned yield an empty class name — it must be filtered
  // out, because a <SelectItem value=""> throws and takes the whole page down.
  const uniqueClasses = Array.from(
    new Set(promotionStudents.map((s) => s.currentClass).filter(Boolean))
  ).sort()

  const handlePromote = () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    if (!selectedStudent || !selectedNextClassId) return
    setPromoting(true)
    api.post(`/api/students/${selectedStudent.id}/promote/`, {
      new_class: Number(selectedNextClassId),
      movement_type: selectedMovementType,
      reason: movementReason,
    })
      .then(() => {
        setPromoted((prev) => [...prev, selectedStudent.id])
        setConfirmOpen(false)
        setSelectedStudent(null)
        setSelectedNextClassId("")
        setSelectedMovementType("promotion")
        setMovementReason("")
        loadStudents()
      })
      .catch(() => {})
      .finally(() => setPromoting(false))
  }

  const handleBulkPromote = () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    const eligibleStudents = promotionStudents.filter((s) => s.status === "eligible" && !promoted.includes(s.id))
    // For bulk promote: find the next class dynamically by looking for the next level
    // Tanzanian pattern: "Std 1" → "Std 2", "Form 1A" → "Form 2A", etc.
    const getNextClass = (currentName: string) => {
      // Match pattern: extract level number and increment it
      const match = currentName.match(/^(.*?)(\d+)(\s*[A-Z]?)$/)
      if (!match) return null
      const prefix = match[1]  // e.g. "Std ", "Form "
      const level  = parseInt(match[2]) + 1
      const arm    = match[3]  // e.g. "A", "B", ""
      const nextName = `${prefix}${level}${arm}`.trim()
      return classes.find((c: any) => c.name === nextName) || null
    }
    const promises = eligibleStudents.map((s) => {
      const nextCls = getNextClass(s.currentClass)
      if (!nextCls) return Promise.resolve()
      return api.post(`/api/students/${s.id}/promote/`, {
        new_class: nextCls.id,
        movement_type: "promotion",
      }).catch(() => {})
    })
    setBulkPromoting(true)
    Promise.all(promises).then(() => {
      setPromoted(eligibleStudents.map((s) => s.id))
      setBulkConfirmOpen(false)
      loadStudents()
    }).finally(() => setBulkPromoting(false))
  }

  if (authLoading || !user) return null
  if (!["super_admin", "admin"].includes(user.role)) return null

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <DashboardHeader
        title="Student Promotions"
        description="Review and process end-of-year student class movements — promotions, stream changes, repetitions and demotions."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Students",   value: total,          icon: Users,         color: "text-primary",     bg: "bg-primary/10" },
          { label: "Eligible",         value: eligible,       icon: CheckCircle2,  color: "text-accent",      bg: "bg-accent/10" },
          { label: "Under Review",     value: review,         icon: AlertTriangle, color: "text-yellow-600",  bg: "bg-yellow-500/10" },
          { label: "Repeat Year",      value: repeat,         icon: XCircle,       color: "text-destructive", bg: "bg-destructive/10" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className={`rounded-lg p-2 ${bg}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Promotion Rate Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-accent" />
                Overall Promotion Rate
              </CardTitle>
              <CardDescription>Percentage of students eligible for promotion or graduation this term</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1 bg-accent/10 text-accent border-accent/30">
                <Award className="h-3 w-3" />
                {graduated} Graduating
              </Badge>
              <span className="text-3xl font-bold text-accent">{promotionRate}%</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={promotionRate} className="h-3" />
          <div className="mt-2 flex gap-6 text-sm text-muted-foreground">
            <span className="text-accent">● Eligible / Graduated: {eligible + graduated}</span>
            <span className="text-yellow-600">● Under Review: {review}</span>
            <span className="text-destructive">● Repeat: {repeat}</span>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Promotion List</CardTitle>
              <CardDescription>All students pending promotion review for Term 2 ending</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1" onClick={() => exportCSV(filtered, "promotions.csv")}>
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button
                size="sm"
                className="gap-1"
                onClick={() => setBulkConfirmOpen(true)}
              >
                <ArrowUpCircle className="h-4 w-4" />
                Promote All Eligible
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or reg. number..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {uniqueClasses.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="eligible">Eligible</SelectItem>
                <SelectItem value="review">Under Review</SelectItem>
                <SelectItem value="repeat">Repeat Year</SelectItem>
                <SelectItem value="graduated">Graduated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Reg. No.</TableHead>
                <TableHead>Current Class</TableHead>
                <TableHead className="hidden md:table-cell">Next Class</TableHead>
                <TableHead className="hidden sm:table-cell">Average</TableHead>
                <TableHead className="hidden lg:table-cell">Attendance</TableHead>
                <TableHead className="hidden lg:table-cell">Fee Status</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                    No students match your search criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((student) => {
                  const cfg = (statusConfig as any)[student.status] ?? statusConfig.eligible
                  const StatusIcon = cfg.icon
                  const isPromoted = promoted.includes(student.id)
                  return (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                              {String(student.name || "").split(" ").map((n) => n[0]).join("").slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{student.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{student.regNo}</TableCell>
                      <TableCell>
                        {student.currentClass ? (
                          <Badge variant="outline">{student.currentClass}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Unassigned</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {student.nextClass === "Graduated" ? (
                          <Badge className="bg-primary/15 text-primary border border-primary/30 hover:bg-primary/20">
                            <GraduationCap className="mr-1 h-3 w-3" />
                            Graduated
                          </Badge>
                        ) : (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <ChevronRight className="h-3 w-3" />
                            {student.nextClass}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className={gradeColor(student.grade)}>
                          {student.average.toFixed(1)}% ({student.grade})
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          <Progress
                            value={student.attendance}
                            className="h-1.5 w-16"
                          />
                          <span className="text-sm">{student.attendance}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge
                          variant="outline"
                          className={
                            student.feeStatus === "paid"
                              ? "bg-accent/10 text-accent border-accent/30"
                              : student.feeStatus === "partial"
                              ? "bg-yellow-500/10 text-yellow-700 border-yellow-400/30"
                              : "bg-destructive/10 text-destructive border-destructive/30"
                          }
                        >
                          {student.feeStatus.charAt(0).toUpperCase() + student.feeStatus.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`gap-1 ${cfg.color}`}
                        >
                          <StatusIcon className={`h-3 w-3 ${cfg.iconColor}`} />
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isPromoted ? (
                          <Badge className="bg-accent/15 text-accent border border-accent/30 hover:bg-accent/20">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Moved
                          </Badge>
                        ) : student.status === "graduated" ? (
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled>
                            <GraduationCap className="h-3 w-3" />
                            Completed
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 text-xs"
                            onClick={() => { setSelectedStudent(student); setSelectedMovementType("promotion"); setConfirmOpen(true) }}
                          >
                            <ArrowUpCircle className="h-3 w-3" />
                            Move
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Single move dialog */}
      <Dialog open={confirmOpen} onOpenChange={(o) => { setConfirmOpen(o); if (!o) { setSelectedNextClassId(""); setMovementReason("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Student</DialogTitle>
            <DialogDescription>
              Change class assignment for <strong>{selectedStudent?.name}</strong> (currently in{" "}
              <strong>{selectedStudent?.currentClass}</strong>).
            </DialogDescription>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-4">
              {/* Movement Type */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Movement Type *</label>
                <Select value={selectedMovementType} onValueChange={setSelectedMovementType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOVEMENT_TYPES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        <div>
                          <span className="font-medium">{m.label}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{m.desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Target Class */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Target Class *</label>
                <Select value={selectedNextClassId} onValueChange={setSelectedNextClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}{c.name === selectedStudent?.currentClass ? " (current)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Reason */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Reason <span className="text-muted-foreground">(optional)</span></label>
                <input
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Failed end-of-term exams, Parent request..."
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                />
              </div>
              <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Academic Average</span>
                  <span className={gradeColor(selectedStudent.grade)}>
                    {selectedStudent.average > 0 ? `${selectedStudent.average.toFixed(1)}% — Grade ${selectedStudent.grade}` : "No results yet"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fee Status</span>
                  <span className="capitalize">{selectedStudent.feeStatus}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handlePromote} disabled={!selectedNextClassId || promoting}>
              <ArrowUpCircle className="mr-2 h-4 w-4" />
              {promoting ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk promote dialog */}
      <Dialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Promote All Eligible Students</DialogTitle>
            <DialogDescription>
              This will promote all <strong>{eligible}</strong> eligible students to their
              respective next classes. Students under review or repeating will not be affected.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Students to be promoted</span>
              <span className="font-semibold text-accent">{eligible}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Skipped (under review)</span>
              <span className="text-yellow-600">{review}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Skipped (repeat year)</span>
              <span className="text-destructive">{repeat}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkPromote} disabled={bulkPromoting}>
              <ArrowUpCircle className="mr-2 h-4 w-4" />
              {bulkPromoting ? "Promoting..." : `Promote ${eligible} Students`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
