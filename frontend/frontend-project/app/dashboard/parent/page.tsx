"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { api } from "@/lib/api-client"
import { useTimetablePeriods, periodLabel, periodTime } from "@/hooks/use-timetable-periods"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  User, CreditCard, ClipboardList, AlertCircle, CheckCircle2,
  Clock, GraduationCap, Phone, BookOpen, Users, CalendarDays,
  LayoutGrid, MessageCircle, Send, CheckCheck, Circle, FileCheck, XCircle,
  PlusCircle, ChevronLeft, ChevronRight, Loader2, School,
} from "lucide-react"
import { Suspense } from "react"

function ParentPortalContent() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeChild, setActiveChild] = useState(0)
  // Read ?tab= from URL to pre-select a tab (e.g. from sidebar links)
  const defaultTab = searchParams.get("tab") || "info"

  // Attendance
  const [attendanceData, setAttendanceData] = useState<any[]>([])
  // Timetable
  const [timetableData, setTimetableData] = useState<any[]>([])
  // Messaging
  const [threads, setThreads] = useState<any[]>([])
  const [activeThread, setActiveThread] = useState<any>(null)
  const [threadMessages, setThreadMessages] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [msgBody, setMsgBody] = useState("")
  const [msgSending, setMsgSending] = useState(false)
  const [showNewMsg, setShowNewMsg] = useState(false)
  const [newMsgRecipient, setNewMsgRecipient] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  // Bell schedule configured by the school, shared with the admin timetable.
  const { periods: PERIODS } = useTimetablePeriods()

  // Application tracking
  const [applications, setApplications] = useState<any[]>([])
  const [applyWindow, setApplyWindow] = useState<any>(null)
  const [showApply, setShowApply] = useState(false)
  const [applyStep, setApplyStep] = useState<1 | 2 | 3>(1)
  const [applySubmitting, setApplySubmitting] = useState(false)
  const [applyError, setApplyError] = useState("")
  const [applySuccess, setApplySuccess] = useState<string | null>(null)
  const APPLY_CLASSES = [
    "Std 1", "Std 2", "Std 3", "Std 4", "Std 5", "Std 6", "Std 7",
    "Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "Form 6",
  ]
  const [applyForm, setApplyForm] = useState({
    first_name: "", last_name: "", middle_name: "",
    date_of_birth: "", gender: "", religion: "", nationality: "Tanzanian",
    previous_school: "", applying_for_class: "", student_type: "Day",
    parent_name: "", parent_phone: "", parent_email: "",
    parent_address: "", relationship: "Parent",
  })
  const [applyErrors, setApplyErrors] = useState<Record<string, string>>({})

  function openApply() {
    setApplyForm(f => ({
      ...f,
      first_name: "", last_name: "", middle_name: "",
      date_of_birth: "", gender: "", religion: "",
      previous_school: "", applying_for_class: "",
      parent_name: `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim(),
      parent_email: user?.email ?? "",
    }))
    setApplyStep(1)
    setApplyError("")
    setApplySuccess(null)
    setApplyErrors({})
    setShowApply(true)
  }

  function setApplyField(k: string, v: string) {
    setApplyForm(f => ({ ...f, [k]: v }))
    setApplyErrors(e => { const n = { ...e }; delete n[k]; return n })
  }

  function validateApplyStep(s: 1 | 2 | 3) {
    const e: Record<string, string> = {}
    if (s === 1) {
      if (!applyForm.first_name.trim()) e.first_name = "Required"
      if (!applyForm.last_name.trim()) e.last_name = "Required"
      if (!applyForm.date_of_birth) e.date_of_birth = "Required"
      if (!applyForm.gender) e.gender = "Required"
      if (!applyForm.applying_for_class) e.applying_for_class = "Required"
    }
    if (s === 2) {
      if (!applyForm.parent_name.trim()) e.parent_name = "Required"
      if (!applyForm.parent_phone.trim()) e.parent_phone = "Required"
    }
    setApplyErrors(e)
    return Object.keys(e).length === 0
  }

  async function submitApply() {
    if (!validateApplyStep(3)) return
    setApplySubmitting(true)
    setApplyError("")
    try {
      const payload = {
        ...applyForm,
        window: applyWindow?.id,
        academic_session: applyWindow?.academic_session,
      }
      const res = await api.post("/api/applicants/", payload)
      const ref = `APP-${String(res.data.id).padStart(5, "0")}`
      setApplySuccess(ref)
      // Refresh application list
      api.get("/api/applicants/my-applications/").then(r => setApplications(r.data?.results ?? [])).catch(() => {})
    } catch (e: any) {
      const detail = e?.response?.data
      if (detail && typeof detail === "object") {
        const msgs = Object.entries(detail).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`).join(" · ")
        setApplyError(msgs)
      } else {
        setApplyError("Submission failed. Please try again.")
      }
    } finally { setApplySubmitting(false) }
  }

  useEffect(() => {
    if (authLoading || !user) return
    if (user.role !== "parent") return
    api.get("/api/parent/dashboard/")
      .then(r => setData(r.data))
      .catch(e => {
        const msg = e?.response?.data?.error || "Failed to load your child's information."
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [user, authLoading])

  // Load attendance + timetable + message threads in parallel
  useEffect(() => {
    if (authLoading || !user || user.role !== "parent") return
    api.get("/api/parent/attendance/").then(r => setAttendanceData(r.data?.children ?? [])).catch(() => {})
    api.get("/api/parent/timetable/").then(r => setTimetableData(r.data?.children ?? [])).catch(() => {})
    api.get("/api/messages/").then(r => setThreads(r.data ?? [])).catch(() => {})
    api.get("/api/messages/contacts/").then(r => setContacts(r.data ?? [])).catch(() => {})
    api.get("/api/applicants/my-applications/").then(r => setApplications(r.data?.results ?? [])).catch(() => {})
    // Fetch active admission window for the inline apply form
    const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    fetch(`${BASE}/api/admission-windows/active/`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setApplyWindow(d))
      .catch(() => {})
  }, [user, authLoading])

  // Load messages when a thread is selected
  useEffect(() => {
    if (!activeThread) return
    api.get(`/api/messages/?thread=${activeThread.partnerId}`)
      .then(r => { setThreadMessages(r.data ?? []); setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100) })
      .catch(() => {})
  }, [activeThread])

  const sendMessage = async (recipientId: string | number) => {
    if (!msgBody.trim()) return
    setMsgSending(true)
    try {
      await api.post("/api/messages/", { recipientId, body: msgBody.trim() })
      setMsgBody("")
      // Refresh thread
      const r = await api.get(`/api/messages/?thread=${recipientId}`)
      setThreadMessages(r.data ?? [])
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
      // Refresh thread list
      api.get("/api/messages/").then(r2 => setThreads(r2.data ?? [])).catch(() => {})
    } catch { /* silent */ } finally { setMsgSending(false) }
  }

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

  if (loading) {
    return (
      <>
        <DashboardHeader title="My Child's Portal" description="View your child's school information" />
        <div className="p-6 text-center text-sm text-muted-foreground">Loading...</div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <DashboardHeader title="My Child's Portal" description="View your child's school information" />
        <div className="p-6">
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-center gap-3 p-6">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  const { children } = data as { children: any[] }
  const childData = children?.[activeChild]
  if (!childData) return null
  const { student, payments, results, summary } = childData
  const passportDoc = student.documents?.find((d: any) => d.documentType === "passport_photo")
  const photoUrl = passportDoc?.fileUrl || passportDoc?.file || null

  const fmtNaira = (n: number) =>
    new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", minimumFractionDigits: 0 }).format(n)

  const feeStatusColor: Record<string, string> = {
    paid: "bg-accent/10 text-accent",
    partial: "bg-yellow-100 text-yellow-700",
    unpaid: "bg-destructive/10 text-destructive",
  }

  const paymentStatusColor: Record<string, string> = {
    confirmed: "bg-accent/10 text-accent",
    pending: "bg-yellow-100 text-yellow-700",
    failed: "bg-destructive/10 text-destructive",
  }

  if (authLoading || !user) return null
  // Staff (super_admin, admin, teacher, accountant) can view a parent account
  // if (user.role !== "parent") { router.replace("/dashboard"); return null }
  const canView = user.role === "parent" || ["super_admin", "admin", "teacher", "accountant"].includes(user.role)
  if (!canView) { router.replace("/dashboard"); return null }


  return (
    <>
      <DashboardHeader
        title="My Child's Portal"
        description="View your child's academic and payment information"
      />

      <div className="p-6 flex flex-col gap-6">

        {/* Child Selector (only shown when there are multiple children) */}
        {children.length > 1 && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Select Child
              </p>
              <div className="flex flex-wrap gap-2">
                {children.map((c: any, i: number) => (
                  <button
                    key={c.student.id}
                    onClick={() => setActiveChild(i)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      activeChild === i
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-transparent hover:border-border"
                    }`}
                  >
                    {c.student.fullName}
                    <span className="ml-1.5 text-[11px] opacity-70">{c.student.className}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Student Profile Card */}
        <Card className="overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-primary via-primary/90 to-primary/60" />
          <CardContent className="pt-0 px-6 pb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-10">
              <Avatar className="h-20 w-20 border-4 border-background shadow-md">
                {photoUrl && <AvatarImage src={photoUrl} alt={student.fullName} />}
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                  {student.firstName?.[0]}{student.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 pb-1">
                <h2 className="text-xl font-bold text-card-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                  {student.fullName}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-sm text-muted-foreground">{student.regNo}</span>
                  <Badge variant="secondary" className="text-[11px]">{student.className}</Badge>
                  <Badge variant="secondary" className={`text-[11px] ${feeStatusColor[student.feeStatus] || ""}`}>
                    Fee: {student.feeStatus}
                  </Badge>
                  <Badge variant="secondary" className={`text-[11px] ${student.status === "active" ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"}`}>
                    {student.status}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Total Paid", value: fmtNaira(summary.totalPaid), icon: CheckCircle2, color: "text-accent" },
            { label: "Pending", value: fmtNaira(summary.pendingAmount), icon: Clock, color: "text-yellow-600" },
            { label: "Total Payments", value: summary.paymentCount, icon: CreditCard, color: "text-primary" },
            { label: "Results Available", value: results.length, icon: ClipboardList, color: "text-chart-4" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-muted shrink-0`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className="text-base font-bold text-card-foreground truncate" style={{ fontFamily: "var(--font-heading)" }}>{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs: Info / Payments / Results */}
        <Tabs defaultValue={defaultTab}>
          <TabsList className="w-full flex-wrap h-auto gap-1">
            <TabsTrigger value="info" className="flex-1 gap-1.5"><User className="h-3.5 w-3.5" />Profile</TabsTrigger>
            <TabsTrigger value="payments" className="flex-1 gap-1.5"><CreditCard className="h-3.5 w-3.5" />Payments</TabsTrigger>
            <TabsTrigger value="results" className="flex-1 gap-1.5"><ClipboardList className="h-3.5 w-3.5" />Results</TabsTrigger>
            <TabsTrigger value="attendance" className="flex-1 gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Attendance</TabsTrigger>
            <TabsTrigger value="timetable" className="flex-1 gap-1.5"><LayoutGrid className="h-3.5 w-3.5" />Timetable</TabsTrigger>
            <TabsTrigger value="messages" className="flex-1 gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" />Messages
              {threads.reduce((acc, t) => acc + (t.unread || 0), 0) > 0 && (
                <span className="ml-1 text-[10px] bg-destructive text-white rounded-full px-1.5 py-0.5 leading-none">
                  {threads.reduce((acc, t) => acc + (t.unread || 0), 0)}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="application" className="flex-1 gap-1.5"><FileCheck className="h-3.5 w-3.5" />Application</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="info" className="mt-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" /> Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  {[
                    { label: "Full Name", value: student.fullName },
                    { label: "Date of Birth", value: student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "—" },
                    { label: "Gender", value: student.gender || "—" },
                    { label: "Blood Group", value: student.bloodGroup || "—" },
                    { label: "Religion", value: student.religion || "—" },
                    { label: "State of Origin", value: student.stateOfOrigin || "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between py-2.5 text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium text-right max-w-[60%]">{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-primary" /> Academic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  {[
                    { label: "Class", value: student.className || "—" },
                    { label: "Reg. Number", value: student.regNo || "—" },
                    { label: "Session", value: student.academicSession || "—" },
                    { label: "Student Type", value: student.studentType || "—" },
                    { label: "Admission Date", value: student.admissionDate ? new Date(student.admissionDate).toLocaleDateString("en-GB") : "—" },
                    { label: "Status", value: student.status || "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between py-2.5 text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium text-right max-w-[60%]">{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              {student.parent && (
                <Card className="md:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Phone className="h-4 w-4 text-primary" /> Parent / Guardian on Record
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-x-8 divide-y divide-border md:grid-cols-4 md:divide-y-0">
                      {[
                        { label: "Name", value: student.parent.fullName },
                        { label: "Relationship", value: student.parent.relationship },
                        { label: "Phone", value: student.parent.phone },
                        { label: "Email", value: student.parent.email || "—" },
                      ].map(({ label, value }) => (
                        <div key={label} className="py-2.5 text-sm">
                          <p className="text-[11px] text-muted-foreground">{label}</p>
                          <p className="font-medium mt-0.5">{value}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Payment History</CardTitle>
                <CardDescription>All recorded payments for {student.firstName}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="rounded-lg border border-border overflow-hidden mx-6 mb-6">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent bg-muted/50">
                        <TableHead className="text-xs font-semibold">Date</TableHead>
                        <TableHead className="text-xs font-semibold">Category</TableHead>
                        <TableHead className="text-xs font-semibold">Term</TableHead>
                        <TableHead className="text-xs font-semibold">Method</TableHead>
                        <TableHead className="text-xs font-semibold">Amount</TableHead>
                        <TableHead className="text-xs font-semibold">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                            No payments recorded yet.
                          </TableCell>
                        </TableRow>
                      ) : payments.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-sm">{p.date ? new Date(p.date).toLocaleDateString("en-GB") : "—"}</TableCell>
                          <TableCell className="text-sm">{p.category || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{p.term || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{p.method || "—"}</TableCell>
                          <TableCell className="text-sm font-semibold">
                            {fmtNaira(parseFloat(p.amount || 0))}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`text-[11px] ${paymentStatusColor[p.status] || ""}`}>
                              {p.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results" className="mt-4">
            {student.feeStatus !== "paid" ? (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                  <p className="font-semibold text-destructive">Results Locked — Fees Not Fully Paid</p>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Access to academic results requires all school fees to be fully paid.
                    Please complete your payment to view{" "}
                    {results.length > 0 ? `${results.length} available result${results.length > 1 ? "s" : ""}` : "results"}.
                  </p>
                </CardContent>
              </Card>
            ) : results.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  No exam results available yet.
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col gap-4">
                {results.map((result: any) => (
                  <Card key={result.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-primary" />
                          {result.term} — {result.academicSession}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[11px]">
                            Avg: {parseFloat(result.average || 0).toFixed(1)}%
                          </Badge>
                          <Badge variant="secondary" className="text-[11px]">
                            Pos: {result.position || "—"}
                          </Badge>
                          <Badge variant="secondary" className={`text-[11px] ${result.status === "promoted" ? "bg-accent/10 text-accent" : result.status === "repeat" ? "bg-destructive/10 text-destructive" : ""}`}>
                            {result.status}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    {result.subjectResults && result.subjectResults.length > 0 && (
                      <CardContent className="p-0">
                        <div className="rounded-lg border border-border overflow-hidden mx-6 mb-6">
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent bg-muted/50">
                                <TableHead className="text-xs font-semibold">Subject</TableHead>
                                <TableHead className="text-xs font-semibold">CA Score</TableHead>
                                <TableHead className="text-xs font-semibold">Exam Score</TableHead>
                                <TableHead className="text-xs font-semibold">Total</TableHead>
                                <TableHead className="text-xs font-semibold">Grade</TableHead>
                                <TableHead className="text-xs font-semibold">Position</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {result.subjectResults.map((sr: any) => (
                                <TableRow key={sr.id}>
                                  <TableCell className="text-sm font-medium">{sr.subject?.name || sr.subjectName || "—"}</TableCell>
                                  <TableCell className="text-sm">{sr.caScore}/30</TableCell>
                                  <TableCell className="text-sm">{sr.examScore}/70</TableCell>
                                  <TableCell className="text-sm font-semibold">{sr.total}/100</TableCell>
                                  <TableCell>
                                    <Badge variant="secondary" className={`text-[11px] ${
                                      sr.grade === "A" ? "bg-accent/10 text-accent" :
                                      sr.grade === "B" ? "bg-primary/10 text-primary" :
                                      sr.grade === "F" ? "bg-destructive/10 text-destructive" : ""
                                    }`}>
                                      {sr.grade}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{sr.position || "—"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          {/* ── Attendance Tab ──────────────────────────────── */}
          <TabsContent value="attendance" className="mt-4">
            {(() => {
              const childAtt = attendanceData.find((c: any) => c.studentId === childData?.student?.id) || attendanceData[activeChild]
              if (!childAtt) return (
                <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No attendance records available.</CardContent></Card>
              )
              const { summary, records } = childAtt
              const statusColor: Record<string, string> = {
                present: "bg-accent/10 text-accent",
                absent: "bg-destructive/10 text-destructive",
                late: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400",
              }
              return (
                <div className="flex flex-col gap-4">
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Attendance Rate", value: `${summary.rate}%`, color: "text-accent" },
                      { label: "Present Days", value: summary.present, color: "text-accent" },
                      { label: "Absent Days", value: summary.absent, color: "text-destructive" },
                      { label: "Late Days", value: summary.late, color: "text-yellow-600" },
                    ].map(s => (
                      <Card key={s.label}>
                        <CardContent className="p-4">
                          <p className="text-[11px] text-muted-foreground">{s.label}</p>
                          <p className={`text-2xl font-black mt-1 ${s.color}`} style={{ fontFamily: "var(--font-heading)" }}>{s.value}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {/* Rate bar */}
                  <Card>
                    <CardContent className="p-4 flex items-center gap-4">
                      <span className="text-sm font-semibold text-muted-foreground w-28 shrink-0">Attendance Rate</span>
                      <Progress value={summary.rate} className="flex-1 h-3" />
                      <span className="text-sm font-bold w-12 text-right">{summary.rate}%</span>
                    </CardContent>
                  </Card>
                  {/* Records table */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold">Daily Records (last 90 days)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="rounded-lg border border-border overflow-hidden mx-6 mb-6">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                              <TableHead className="text-xs font-semibold">Date</TableHead>
                              <TableHead className="text-xs font-semibold">Status</TableHead>
                              <TableHead className="text-xs font-semibold">Note</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {records.length === 0 ? (
                              <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">No records yet.</TableCell></TableRow>
                            ) : records.map((r: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell className="text-sm">{new Date(r.date).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className={`text-[11px] capitalize ${statusColor[r.status] || ""}`}>{r.status}</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">{r.note || "—"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )
            })()}
          </TabsContent>

          {/* ── Timetable Tab ─────────────────────────────── */}
          <TabsContent value="timetable" className="mt-4">
            {(() => {
              const childTt = timetableData.find((c: any) => c.studentId === childData?.student?.id) || timetableData[activeChild]
              if (!childTt) return (
                <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No timetable available for your child&apos;s class yet.</CardContent></Card>
              )
              const { slots, className: cls } = childTt
              const PERIOD_COLORS = [
                "bg-primary/10 text-primary border-primary/20",
                "bg-accent/10 text-accent border-accent/20",
                "bg-chart-3/10 text-chart-3 border-chart-3/20",
                "bg-chart-4/10 text-chart-4 border-chart-4/20",
                "bg-chart-5/10 text-chart-5 border-chart-5/20",
                "bg-primary/10 text-primary border-primary/20",
              ]
              return (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <LayoutGrid className="h-4 w-4 text-primary" /> Weekly Timetable — {cls}
                    </CardTitle>
                    <CardDescription>Class schedule for the current term</CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto p-0 pb-6 px-6">
                    <table className="w-full text-xs border-separate border-spacing-1 min-w-[540px]">
                      <thead>
                        <tr>
                          <th className="text-left px-2 py-1.5 text-muted-foreground font-semibold w-20">Period</th>
                          {DAYS.map(d => (
                            <th key={d} className="text-center px-2 py-1.5 text-muted-foreground font-semibold">{d}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {PERIODS.map((p) => p.isBreak ? (
                          <tr key={p.period}>
                            <td className="px-2 py-1 text-muted-foreground text-[11px]">
                              <div className="font-semibold">{periodLabel(p)}</div>
                              <div className="opacity-70">{periodTime(p)}</div>
                            </td>
                            <td colSpan={DAYS.length} className="px-1 py-1">
                              <div className="rounded-lg border border-dashed border-border bg-muted/40 py-2 text-center text-[11px] text-muted-foreground">
                                {periodLabel(p)}
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr key={p.period}>
                            <td className="px-2 py-1 text-muted-foreground text-[11px]">
                              <div className="font-semibold">{periodLabel(p)}</div>
                              <div className="opacity-70">{periodTime(p)}</div>
                            </td>
                            {DAYS.map(day => {
                              const period = p.period
                              const slot = slots.find((s: any) => s.day === day && s.period === period)
                              return (
                                <td key={day} className="px-1 py-1">
                                  {slot ? (
                                    <div className={`rounded-lg border p-2 ${PERIOD_COLORS[(period - 1) % PERIOD_COLORS.length]}`}>
                                      <div className="font-semibold leading-tight">{slot.subjectName || slot.subject?.name || "—"}</div>
                                      {slot.teacherName || slot.teacher?.name ? (
                                        <div className="opacity-70 mt-0.5 leading-tight">{slot.teacherName || slot.teacher?.name}</div>
                                      ) : null}
                                      {slot.room ? <div className="opacity-60 leading-tight">{slot.room}</div> : null}
                                    </div>
                                  ) : (
                                    <div className="rounded-lg border border-dashed border-border h-12" />
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )
            })()}
          </TabsContent>

          {/* ── Messages Tab ──────────────────────────────── */}
          <TabsContent value="messages" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[560px]">

              {/* Thread list */}
              <Card className="flex flex-col overflow-hidden">
                <CardHeader className="pb-2 shrink-0 flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Conversations</CardTitle>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowNewMsg(true)}>
                    <Send className="h-3 w-3" /> New
                  </Button>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-2 space-y-1">
                  {threads.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No conversations yet.</p>}
                  {threads.map((t: any) => (
                    <button
                      key={t.partnerId}
                      onClick={() => { setActiveThread(t); setShowNewMsg(false) }}
                      className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${activeThread?.partnerId === t.partnerId ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold truncate">{t.partnerName}</span>
                        {t.unread > 0 && <span className="shrink-0 text-[10px] bg-destructive text-white rounded-full px-1.5 leading-5">{t.unread}</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground capitalize">{t.partnerRole}</p>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{t.lastMessage}</p>
                    </button>
                  ))}
                </CardContent>
              </Card>

              {/* Message pane */}
              <Card className="md:col-span-2 flex flex-col overflow-hidden">
                {showNewMsg ? (
                  <div className="flex flex-col gap-4 p-6 flex-1">
                    <p className="text-sm font-semibold">New Message</p>
                    <Select value={newMsgRecipient} onValueChange={setNewMsgRecipient}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choose a teacher or staff…" /></SelectTrigger>
                      <SelectContent>
                        {contacts.map((c: any) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name} <span className="text-muted-foreground capitalize ml-1">({c.role})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Textarea
                      placeholder="Write your message…"
                      className="flex-1 resize-none min-h-[120px] text-sm"
                      value={msgBody}
                      onChange={e => setMsgBody(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setShowNewMsg(false); setMsgBody(""); setNewMsgRecipient("") }}>Cancel</Button>
                      <Button size="sm" disabled={!newMsgRecipient || !msgBody.trim() || msgSending}
                        onClick={() => {
                          sendMessage(newMsgRecipient).then(() => {
                            const partner = contacts.find((c: any) => String(c.id) === newMsgRecipient)
                            if (partner) setActiveThread({ partnerId: partner.id, partnerName: partner.name, partnerRole: partner.role })
                            setShowNewMsg(false); setNewMsgRecipient("")
                          })
                        }}>
                        <Send className="h-3.5 w-3.5 mr-1.5" />{msgSending ? "Sending…" : "Send"}
                      </Button>
                    </div>
                  </div>
                ) : activeThread ? (
                  <>
                    <CardHeader className="pb-2 shrink-0 border-b border-border">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-primary" />
                        {activeThread.partnerName}
                        <span className="text-[11px] text-muted-foreground font-normal capitalize">{activeThread.partnerRole}</span>
                      </CardTitle>
                    </CardHeader>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {threadMessages.map((m: any) => {
                        const isMe = m.senderId === user?.id
                        return (
                          <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"}`}>
                              <p className="leading-relaxed">{m.body}</p>
                              <div className={`flex items-center gap-1 mt-1 text-[10px] ${isMe ? "text-primary-foreground/60 justify-end" : "text-muted-foreground"}`}>
                                {new Date(m.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                {isMe && (m.read ? <CheckCheck className="h-3 w-3" /> : <Circle className="h-2.5 w-2.5" />)}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                    <div className="shrink-0 p-3 border-t border-border flex gap-2">
                      <Textarea
                        rows={1}
                        placeholder="Type a message…"
                        className="flex-1 resize-none text-sm min-h-[38px] max-h-[100px]"
                        value={msgBody}
                        onChange={e => setMsgBody(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(activeThread.partnerId) } }}
                      />
                      <Button size="sm" className="h-9 w-9 p-0 shrink-0" disabled={!msgBody.trim() || msgSending}
                        onClick={() => sendMessage(activeThread.partnerId)}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center flex-col gap-3 text-muted-foreground">
                    <MessageCircle className="h-10 w-10 opacity-20" />
                    <p className="text-sm">Select a conversation or start a new one</p>
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* Application Tab */}
          <TabsContent value="application" className="mt-4">
            {/* Apply dialog */}
            <Dialog open={showApply} onOpenChange={setShowApply}>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <School className="h-5 w-5 text-primary" />
                    Apply for a Child
                  </DialogTitle>
                </DialogHeader>

                {applySuccess ? (
                  <div className="space-y-4 py-2">
                    <div className="flex flex-col items-center gap-3 py-4 text-center">
                      <CheckCircle2 className="h-14 w-14 text-green-500" />
                      <p className="text-lg font-bold">Application Submitted!</p>
                      <div className="bg-muted rounded-lg px-6 py-3">
                        <p className="text-xs text-muted-foreground mb-1">Reference Number</p>
                        <p className="text-xl font-mono font-bold tracking-widest">{applySuccess}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" onClick={() => { setApplySuccess(null); setApplyStep(1); setApplyForm(f => ({ ...f, first_name: "", last_name: "", middle_name: "", date_of_birth: "", gender: "", religion: "", previous_school: "", applying_for_class: "" })); setApplyErrors({}) }}>
                        <PlusCircle className="h-4 w-4 mr-1.5" /> Another Child
                      </Button>
                      <Button onClick={() => setShowApply(false)}>Done</Button>
                    </div>
                  </div>
                ) : !applyWindow ? (
                  <div className="py-10 text-center text-muted-foreground">
                    <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm font-medium">Applications are currently closed.</p>
                    <p className="text-xs mt-1">The admin has not opened an application window yet.</p>
                  </div>
                ) : (
                  <div className="space-y-5 py-1">
                    {/* Window info */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                      <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                      Session {applyWindow.academic_session} · Open until {new Date(applyWindow.close_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                      {Number(applyWindow.application_fee) > 0 && <> · Fee: TZS {Number(applyWindow.application_fee).toLocaleString()}</>}
                    </div>

                    {/* Step indicators */}
                    <div className="flex items-center gap-1">
                      {["Child Details", "Parent Contact", "Review"].map((s, i) => (
                        <div key={s} className="flex items-center gap-1 flex-1 min-w-0">
                          <div className={`h-6 w-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0
                            ${i < applyStep - 1 ? "bg-green-500 text-white" : i === applyStep - 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                            {i < applyStep - 1 ? "✓" : i + 1}
                          </div>
                          <span className={`text-xs hidden sm:block truncate ${i === applyStep - 1 ? "font-semibold" : "text-muted-foreground"}`}>{s}</span>
                          {i < 2 && <div className="h-px flex-1 bg-border mx-1" />}
                        </div>
                      ))}
                    </div>

                    {/* Step 1: Child */}
                    {applyStep === 1 && (
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs">First Name *</Label><Input value={applyForm.first_name} onChange={e => setApplyField("first_name", e.target.value)} className="h-9 mt-1" />{applyErrors.first_name && <p className="text-xs text-destructive mt-0.5">{applyErrors.first_name}</p>}</div>
                        <div><Label className="text-xs">Last Name *</Label><Input value={applyForm.last_name} onChange={e => setApplyField("last_name", e.target.value)} className="h-9 mt-1" />{applyErrors.last_name && <p className="text-xs text-destructive mt-0.5">{applyErrors.last_name}</p>}</div>
                        <div><Label className="text-xs">Middle Name</Label><Input value={applyForm.middle_name} onChange={e => setApplyField("middle_name", e.target.value)} className="h-9 mt-1" /></div>
                        <div><Label className="text-xs">Date of Birth *</Label><Input type="date" value={applyForm.date_of_birth} onChange={e => setApplyField("date_of_birth", e.target.value)} className="h-9 mt-1" />{applyErrors.date_of_birth && <p className="text-xs text-destructive mt-0.5">{applyErrors.date_of_birth}</p>}</div>
                        <div>
                          <Label className="text-xs">Gender *</Label>
                          <Select value={applyForm.gender} onValueChange={v => setApplyField("gender", v)}>
                            <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Select…" /></SelectTrigger>
                            <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
                          </Select>
                          {applyErrors.gender && <p className="text-xs text-destructive mt-0.5">{applyErrors.gender}</p>}
                        </div>
                        <div><Label className="text-xs">Religion</Label><Input placeholder="e.g. Islam" value={applyForm.religion} onChange={e => setApplyField("religion", e.target.value)} className="h-9 mt-1" /></div>
                        <div><Label className="text-xs">Nationality</Label><Input value={applyForm.nationality} onChange={e => setApplyField("nationality", e.target.value)} className="h-9 mt-1" /></div>
                        <div><Label className="text-xs">Previous School</Label><Input value={applyForm.previous_school} onChange={e => setApplyField("previous_school", e.target.value)} className="h-9 mt-1" /></div>
                        <div>
                          <Label className="text-xs">Applying For Class *</Label>
                          <Select value={applyForm.applying_for_class} onValueChange={v => setApplyField("applying_for_class", v)}>
                            <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Select class…" /></SelectTrigger>
                            <SelectContent>{APPLY_CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                          </Select>
                          {applyErrors.applying_for_class && <p className="text-xs text-destructive mt-0.5">{applyErrors.applying_for_class}</p>}
                        </div>
                        <div>
                          <Label className="text-xs">Student Type</Label>
                          <Select value={applyForm.student_type} onValueChange={v => setApplyField("student_type", v)}>
                            <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="Day">Day</SelectItem><SelectItem value="Boarding">Boarding</SelectItem></SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* Step 2: Parent contact */}
                    {applyStep === 2 && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <Label className="text-xs">Full Name *</Label>
                          <Input value={applyForm.parent_name} onChange={e => setApplyField("parent_name", e.target.value)} className="h-9 mt-1" />
                          {applyErrors.parent_name && <p className="text-xs text-destructive mt-0.5">{applyErrors.parent_name}</p>}
                        </div>
                        <div>
                          <Label className="text-xs">Phone Number *</Label>
                          <Input placeholder="+255…" value={applyForm.parent_phone} onChange={e => setApplyField("parent_phone", e.target.value)} className="h-9 mt-1" />
                          {applyErrors.parent_phone && <p className="text-xs text-destructive mt-0.5">{applyErrors.parent_phone}</p>}
                        </div>
                        <div>
                          <Label className="text-xs">Email (pre-filled)</Label>
                          <Input type="email" value={applyForm.parent_email} onChange={e => setApplyField("parent_email", e.target.value)} className="h-9 mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs">Relationship</Label>
                          <Select value={applyForm.relationship} onValueChange={v => setApplyField("relationship", v)}>
                            <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Parent">Parent</SelectItem>
                              <SelectItem value="Guardian">Guardian</SelectItem>
                              <SelectItem value="Relative">Relative</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div><Label className="text-xs">Home Address</Label><Input value={applyForm.parent_address} onChange={e => setApplyField("parent_address", e.target.value)} className="h-9 mt-1" /></div>
                      </div>
                    )}

                    {/* Step 3: Review */}
                    {applyStep === 3 && (
                      <div className="space-y-3">
                        <div className="rounded-lg border border-border/50 divide-y divide-border/30">
                          {[
                            ["Child", `${applyForm.first_name} ${applyForm.middle_name} ${applyForm.last_name}`.replace(/\s+/g, " ").trim()],
                            ["Date of Birth", applyForm.date_of_birth],
                            ["Gender", applyForm.gender],
                            ["Applying For", applyForm.applying_for_class],
                            ["Student Type", applyForm.student_type],
                            ["Parent Name", applyForm.parent_name],
                            ["Parent Phone", applyForm.parent_phone],
                            ["Parent Email", applyForm.parent_email],
                          ].filter(([, v]) => v).map(([l, v]) => (
                            <div key={l} className="flex justify-between px-3 py-2 text-sm">
                              <span className="text-muted-foreground">{l}</span>
                              <span className="font-medium text-right max-w-[55%]">{v}</span>
                            </div>
                          ))}
                        </div>
                        {applyError && (
                          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>{applyError}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Navigation */}
                    <div className="flex justify-between pt-1">
                      <Button variant="outline" size="sm" onClick={() => setApplyStep(s => (s - 1) as 1 | 2 | 3)} disabled={applyStep === 1}>
                        <ChevronLeft className="h-4 w-4 mr-1" /> Back
                      </Button>
                      {applyStep < 3 ? (
                        <Button size="sm" onClick={() => { if (validateApplyStep(applyStep)) setApplyStep(s => (s + 1) as 1 | 2 | 3) }}>
                          Next <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      ) : (
                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={submitApply} disabled={applySubmitting}>
                          {applySubmitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                          Submit Application
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Header row with Apply button */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-muted-foreground">Your Applications ({applications.length})</p>
              <Button size="sm" onClick={openApply} className="gap-1.5" disabled={!applyWindow}>
                <PlusCircle className="h-4 w-4" />
                {applyWindow ? "Apply for a Child" : "Applications Closed"}
              </Button>
            </div>

            {applications.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No applications yet.</p>
                  {applyWindow
                    ? <p className="text-xs mt-1">Click <strong>Apply for a Child</strong> above to start a new application.</p>
                    : <p className="text-xs mt-1">Applications are currently closed. Check back later.</p>
                  }
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {applications.map((app: any) => {
                  const statusColors: Record<string, string> = {
                    submitted: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
                    payment_pending: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
                    payment_confirmed: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
                    interview_scheduled: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
                    accepted: "bg-green-500/15 text-green-700 dark:text-green-400",
                    declined: "bg-red-500/15 text-red-700 dark:text-red-400",
                    enrolled: "bg-accent/15 text-accent",
                  }
                  const statusLabel: Record<string, string> = {
                    submitted: "Submitted",
                    payment_pending: "Payment Pending",
                    payment_confirmed: "Payment Confirmed",
                    interview_scheduled: "Interview Scheduled",
                    accepted: "Accepted",
                    declined: "Declined",
                    enrolled: "Enrolled",
                  }
                  const steps = [
                    { key: "submitted", label: "Application Received" },
                    { key: "payment_confirmed", label: "Payment Confirmed" },
                    { key: "interview_scheduled", label: "Interview Scheduled" },
                    { key: "accepted", label: "Decision Made" },
                    { key: "enrolled", label: "Enrolled" },
                  ]
                  const stepOrder = ["submitted", "payment_pending", "payment_confirmed", "interview_scheduled", "accepted", "declined", "enrolled"]
                  const currentIdx = stepOrder.indexOf(app.status)
                  return (
                    <Card key={app.id} className="border border-border/50">
                      <CardContent className="pt-5 pb-5 space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{app.firstName} {app.lastName}</p>
                            <p className="text-sm text-muted-foreground">Applying for {app.applyingForClass} · {app.academicSession}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Ref: APP-{String(app.id).padStart(5, "0")} · Applied: {app.applicationDate}</p>
                          </div>
                          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${statusColors[app.status] || ""}`}>
                            {statusLabel[app.status] || app.status}
                          </span>
                        </div>

                        {/* Progress pipeline */}
                        <div className="flex items-center gap-1">
                          {steps.map((s, i) => {
                            const isDeclined = app.status === "declined" && s.key === "accepted"
                            const passed = stepOrder.indexOf(app.status) >= stepOrder.indexOf(s.key)
                            return (
                              <div key={s.key} className="flex items-center gap-1 flex-1 min-w-0">
                                <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold
                                  ${isDeclined ? "bg-red-500 text-white" : passed ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}>
                                  {isDeclined ? "✕" : passed ? "✓" : i + 1}
                                </div>
                                <span className="text-[9px] text-muted-foreground hidden sm:block truncate">{isDeclined ? "Declined" : s.label}</span>
                                {i < steps.length - 1 && <div className="h-px flex-1 bg-border" />}
                              </div>
                            )
                          })}
                        </div>

                        {/* Interview details if scheduled */}
                        {app.interview && (
                          <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm space-y-1">
                            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Interview Details</p>
                            <p>Date: <span className="font-medium">{app.interview.interviewDate}</span></p>
                            {app.interview.marks != null && <p>Marks: <span className="font-medium">{app.interview.marks}/100</span></p>}
                            {app.interview.result !== "pending" && (
                              <div className="flex items-center gap-1.5 mt-1">
                                {app.interview.result === "accepted"
                                  ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  : <XCircle className="h-4 w-4 text-red-500" />}
                                <span className={app.interview.result === "accepted" ? "text-green-700 dark:text-green-400 font-semibold" : "text-red-700 dark:text-red-400 font-semibold"}>
                                  {app.interview.result === "accepted" ? "Accepted — congratulations!" : "Application was not successful."}
                                </span>
                              </div>
                            )}
                            {app.interview.remarks && <p className="text-muted-foreground text-xs">{app.interview.remarks}</p>}
                          </div>
                        )}

                        {/* Payment details if confirmed */}
                        {app.payment && (
                          <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm">
                            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-1">Payment</p>
                            <p>Amount: <span className="font-medium">{Number(app.payment.amount).toLocaleString()} TZS</span> · {app.payment.paymentDate} · {app.payment.paymentMethod}</p>
                            {app.payment.receiptNumber && <p className="text-xs text-muted-foreground">Receipt: {app.payment.receiptNumber}</p>}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

        </Tabs>
      </div>
    </>
  )
}

export default function ParentPortalPage() {
  return (
    <Suspense fallback={null}>
      <ParentPortalContent />
    </Suspense>
  )
}
