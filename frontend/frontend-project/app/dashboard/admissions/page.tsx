"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useUser } from "@/contexts/user-context"
import {
  Search, Plus, Eye, CheckCircle2, XCircle, Calendar,
  ClipboardList, UserCheck, CreditCard, Loader2, X,
  ChevronRight, GraduationCap, Users, Clock, TrendingUp,
} from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { api, getResults } from "@/lib/api-client"
import { useRouter } from "next/navigation"

// ── helpers ───────────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string }> = {
  submitted:            { label: "Submitted",            color: "bg-slate-500/15 text-slate-700 dark:text-slate-300" },
  payment_pending:      { label: "Payment Pending",      color: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
  payment_confirmed:    { label: "Payment Confirmed",    color: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  interview_scheduled:  { label: "Interview Scheduled",  color: "bg-purple-500/15 text-purple-700 dark:text-purple-400" },
  accepted:             { label: "Accepted",             color: "bg-green-500/15 text-green-700 dark:text-green-400" },
  declined:             { label: "Declined",             color: "bg-red-500/15 text-red-700 dark:text-red-400" },
  enrolled:             { label: "Enrolled",             color: "bg-accent/15 text-accent" },
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] || { label: status, color: "" }
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${m.color}`}>{m.label}</span>
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between py-1.5 text-sm border-b border-border/40 last:border-0">
      <span className="text-muted-foreground w-36 shrink-0">{label}</span>
      <span className="font-medium text-card-foreground text-right">{value || "—"}</span>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────
export default function AdmissionsPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()

  const [applicants, setApplicants] = useState<any[]>([])
  const [windows, setWindows] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // View applicant dialog
  const [viewOpen, setViewOpen] = useState(false)
  const [viewApplicant, setViewApplicant] = useState<any>(null)
  const [viewLoading, setViewLoading] = useState(false)

  // Payment confirmation dialog
  const [payOpen, setPayOpen] = useState(false)
  const [payApplicant, setPayApplicant] = useState<any>(null)
  const [payForm, setPayForm] = useState({ amount: "", receipt_number: "", payment_date: "", payment_method: "cash", notes: "" })
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState("")

  // Interview schedule dialog
  const [intOpen, setIntOpen] = useState(false)
  const [intApplicant, setIntApplicant] = useState<any>(null)
  const [intForm, setIntForm] = useState({ interview_date: "", interviewer: "", result: "pending", marks: "", remarks: "" })
  const [intLoading, setIntLoading] = useState(false)
  const [intError, setIntError] = useState("")
  const [staffList, setStaffList] = useState<any[]>([])

  // Result dialog
  const [resultOpen, setResultOpen] = useState(false)
  const [resultApplicant, setResultApplicant] = useState<any>(null)
  const [resultForm, setResultForm] = useState({ result: "accepted", marks: "", remarks: "" })
  const [resultLoading, setResultLoading] = useState(false)
  const [resultError, setResultError] = useState("")

  // Enroll dialog
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [enrollApplicant, setEnrollApplicant] = useState<any>(null)
  const [enrollForm, setEnrollForm] = useState({ reg_no: "", student_class: "", admission_date: "" })
  const [enrollLoading, setEnrollLoading] = useState(false)
  const [enrollError, setEnrollError] = useState("")

  // Window management dialog
  const [windowOpen, setWindowOpen] = useState(false)
  const [windowForm, setWindowForm] = useState({ academic_session: "", open_date: "", close_date: "", application_fee: "", notes: "", is_active: true })
  const [windowLoading, setWindowLoading] = useState(false)
  const [windowError, setWindowError] = useState("")
  const [editWindow, setEditWindow] = useState<any>(null)

  // ── load data ──────────────────────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get("/api/applicants/"),
      api.get("/api/admission-windows/"),
      api.get("/api/classes/"),
      api.get("/api/users/"),
    ]).then(([a, w, c, u]) => {
      setApplicants(getResults(a.data))
      setWindows(getResults(w.data))
      setClasses(getResults(c.data))
      setStaffList(getResults(u.data).filter((u: any) => ["super_admin", "admin", "teacher", "staff"].includes(u.role)))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => { if (!authLoading) load() }, [authLoading, load])

  // ── filtered list ──────────────────────────────────────────────────────────
  const filtered = applicants.filter(a => {
    const name = `${a.firstName} ${a.lastName}`.toLowerCase()
    const matchSearch = !search || name.includes(search.toLowerCase()) || (a.parentName || "").toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === "all" || a.status === statusFilter
    return matchSearch && matchStatus
  })

  // ── stats ──────────────────────────────────────────────────────────────────
  const stats = {
    total: applicants.length,
    pending: applicants.filter(a => ["submitted", "payment_pending", "payment_confirmed", "interview_scheduled"].includes(a.status)).length,
    accepted: applicants.filter(a => a.status === "accepted").length,
    enrolled: applicants.filter(a => a.status === "enrolled").length,
  }

  // ── open view ──────────────────────────────────────────────────────────────
  function openView(a: any) {
    setViewApplicant(null)
    setViewOpen(true)
    setViewLoading(true)
    api.get(`/api/applicants/${a.id}/`).then(r => {
      setViewApplicant(r.data)
    }).catch(() => {}).finally(() => setViewLoading(false))
  }

  // ── payment dialog helpers ─────────────────────────────────────────────────
  function openPay(a: any) {
    setPayApplicant(a)
    setPayForm({ amount: windows.find((w: any) => w.id === a.window)?.applicationFee || "", receipt_number: "", payment_date: new Date().toISOString().split("T")[0], payment_method: "cash", notes: "" })
    setPayError("")
    setPayOpen(true)
  }
  async function submitPay() {
    if (!payForm.amount || !payForm.payment_date) { setPayError("Amount and date are required."); return }
    setPayLoading(true)
    try {
      await api.post(`/api/applicants/${payApplicant.id}/confirm-payment/`, payForm)
      setPayOpen(false)
      load()
    } catch (e: any) {
      setPayError(e?.response?.data?.detail || "Failed to confirm payment.")
    } finally { setPayLoading(false) }
  }

  // ── interview dialog helpers ───────────────────────────────────────────────
  function openInterview(a: any) {
    setIntApplicant(a)
    const existing = a.interview || {}
    setIntForm({
      interview_date: existing.interviewDate || "",
      interviewer: existing.interviewer || "",
      result: existing.result || "pending",
      marks: existing.marks != null ? String(existing.marks) : "",
      remarks: existing.remarks || "",
    })
    setIntError("")
    setIntOpen(true)
  }
  async function submitInterview() {
    if (!intForm.interview_date) { setIntError("Interview date is required."); return }
    setIntLoading(true)
    try {
      const payload = {
        ...intForm,
        interviewer: intForm.interviewer || null,
        marks: intForm.marks !== "" ? Number(intForm.marks) : null,
      }
      await api.post(`/api/applicants/${intApplicant.id}/schedule-interview/`, payload)
      setIntOpen(false)
      load()
    } catch (e: any) {
      const data = e?.response?.data
      if (data && typeof data === "object") {
        const msgs = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`).join(" · ")
        setIntError(msgs)
      } else {
        setIntError("Failed to save interview.")
      }
    } finally { setIntLoading(false) }
  }

  // ── result dialog helpers ──────────────────────────────────────────────────
  function openResult(a: any) {
    setResultApplicant(a)
    const interview = a.interview || {}
    setResultForm({ result: interview.result === "accepted" || interview.result === "declined" ? interview.result : "accepted", marks: interview.marks != null ? String(interview.marks) : "", remarks: interview.remarks || "" })
    setResultError("")
    setResultOpen(true)
  }
  async function submitResult() {
    setResultLoading(true)
    try {
      const payload = {
        ...resultForm,
        marks: resultForm.marks !== "" ? Number(resultForm.marks) : null,
      }
      await api.post(`/api/applicants/${resultApplicant.id}/record-result/`, payload)
      setResultOpen(false)
      load()
    } catch (e: any) {
      const data = e?.response?.data
      if (data && typeof data === "object") {
        const msgs = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`).join(" · ")
        setResultError(msgs)
      } else {
        setResultError("Failed to save result.")
      }
    } finally { setResultLoading(false) }
  }

  // ── enroll dialog helpers ──────────────────────────────────────────────────
  function openEnroll(a: any) {
    setEnrollApplicant(a)
    setEnrollForm({ reg_no: "", student_class: "", admission_date: new Date().toISOString().split("T")[0] })
    setEnrollError("")
    setEnrollOpen(true)
  }
  async function submitEnroll() {
    if (!enrollForm.reg_no || !enrollForm.admission_date) { setEnrollError("Reg. number and admission date are required."); return }
    setEnrollLoading(true)
    try {
      await api.post(`/api/applicants/${enrollApplicant.id}/enroll/`, enrollForm)
      setEnrollOpen(false)
      load()
    } catch (e: any) {
      setEnrollError(e?.response?.data?.detail || "Failed to enroll student.")
    } finally { setEnrollLoading(false) }
  }

  // ── window dialog helpers ──────────────────────────────────────────────────
  function openWindowDialog(w?: any) {
    setEditWindow(w || null)
    setWindowForm(w ? {
      academic_session: w.academicSession,
      open_date: w.openDate,
      close_date: w.closeDate,
      application_fee: String(w.applicationFee),
      notes: w.notes || "",
      is_active: w.isActive,
    } : { academic_session: "", open_date: "", close_date: "", application_fee: "0", notes: "", is_active: true })
    setWindowError("")
    setWindowOpen(true)
  }
  async function submitWindow() {
    if (!windowForm.academic_session || !windowForm.open_date || !windowForm.close_date) {
      setWindowError("Session, open and close dates are required.")
      return
    }
    setWindowLoading(true)
    try {
      if (editWindow) {
        await api.put(`/api/admission-windows/${editWindow.id}/`, windowForm)
      } else {
        await api.post("/api/admission-windows/", windowForm)
      }
      setWindowOpen(false)
      load()
    } catch (e: any) {
      setWindowError(e?.response?.data?.detail || "Failed to save window.")
    } finally { setWindowLoading(false) }
  }

  if (authLoading || loading) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Admissions" description="Student application pipeline" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Admissions" description="Manage student applications and enrolment" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Applications", value: stats.total, icon: ClipboardList, color: "text-blue-500" },
            { label: "In Progress",         value: stats.pending,  icon: Clock,         color: "text-yellow-500" },
            { label: "Accepted",            value: stats.accepted, icon: CheckCircle2,  color: "text-green-500" },
            { label: "Enrolled",            value: stats.enrolled, icon: GraduationCap, color: "text-accent" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="border border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className={`h-8 w-8 ${color} shrink-0`} />
                <div>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Application Windows */}
        <Card className="border border-border/50">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Application Windows</CardTitle>
            <Button size="sm" variant="outline" onClick={() => openWindowDialog()}>
              <Plus className="h-3.5 w-3.5 mr-1" /> New Window
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {windows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No windows created yet. Create one so parents can apply online.</p>
            ) : (
              <div className="space-y-2">
                {windows.map((w: any) => (
                  <div key={w.id} className="flex items-center justify-between rounded-lg border border-border/40 px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Badge variant={w.isActive ? "default" : "secondary"} className="text-[10px]">
                        {w.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <span className="text-sm font-medium">{w.academicSession}</span>
                      <span className="text-xs text-muted-foreground">{w.openDate} → {w.closeDate}</span>
                      {w.applicationFee > 0 && <span className="text-xs text-muted-foreground">Fee: {Number(w.applicationFee).toLocaleString()} TZS</span>}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => openWindowDialog(w)}>Edit</Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Applicants Table */}
        <Card className="border border-border/50">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row gap-3 justify-between">
              <CardTitle className="text-base">Applications</CardTitle>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-8 h-9 w-56 text-sm" placeholder="Search name / parent..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-44 text-sm">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {Object.entries(STATUS_META).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Applicant</TableHead>
                  <TableHead>Class Applied</TableHead>
                  <TableHead>Parent / Guardian</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Interview</TableHead>
                  <TableHead className="text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      No applications found.
                    </TableCell>
                  </TableRow>
                ) : filtered.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{a.firstName} {a.lastName}</div>
                      <div className="text-xs text-muted-foreground">{a.gender}</div>
                    </TableCell>
                    <TableCell className="text-sm">{a.applyingForClass}</TableCell>
                    <TableCell>
                      <div className="text-sm">{a.parentName}</div>
                      <div className="text-xs text-muted-foreground">{a.parentPhone}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.applicationDate}</TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                    <TableCell>
                      {a.interview ? (
                        <div className="text-xs">
                          <div>{a.interview.interviewDate}</div>
                          {a.interview.marks != null && <div className="text-muted-foreground">Marks: {a.interview.marks}/100</div>}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">Not scheduled</span>}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openView(a)} title="View details">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {["submitted", "payment_pending"].includes(a.status) && (
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => openPay(a)}>
                            <CreditCard className="h-3.5 w-3.5 mr-1" />Pay
                          </Button>
                        )}
                        {a.status === "payment_confirmed" && (
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => openInterview(a)}>
                            <Calendar className="h-3.5 w-3.5 mr-1" />Interview
                          </Button>
                        )}
                        {a.status === "interview_scheduled" && (
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => openResult(a)}>
                            <ClipboardList className="h-3.5 w-3.5 mr-1" />Result
                          </Button>
                        )}
                        {a.status === "accepted" && (
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-green-600" onClick={() => openEnroll(a)}>
                            <UserCheck className="h-3.5 w-3.5 mr-1" />Enroll
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* ── View Applicant Dialog ─────────────────────────────────────────── */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Application Details</DialogTitle>
          </DialogHeader>
          {viewLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : viewApplicant ? (
            <Tabs defaultValue="child">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="child" className="flex-1">Child</TabsTrigger>
                <TabsTrigger value="parent" className="flex-1">Parent</TabsTrigger>
                <TabsTrigger value="payment" className="flex-1">Payment</TabsTrigger>
                <TabsTrigger value="interview" className="flex-1">Interview</TabsTrigger>
              </TabsList>
              <TabsContent value="child" className="space-y-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                    {viewApplicant.firstName?.[0]}{viewApplicant.lastName?.[0]}
                  </div>
                  <div>
                    <p className="font-semibold">{viewApplicant.firstName} {viewApplicant.middleName} {viewApplicant.lastName}</p>
                    <StatusBadge status={viewApplicant.status} />
                  </div>
                </div>
                <InfoRow label="Date of Birth" value={viewApplicant.dateOfBirth} />
                <InfoRow label="Gender" value={viewApplicant.gender} />
                <InfoRow label="Religion" value={viewApplicant.religion} />
                <InfoRow label="Nationality" value={viewApplicant.nationality} />
                <InfoRow label="Applying For" value={viewApplicant.applyingForClass} />
                <InfoRow label="Student Type" value={viewApplicant.studentType} />
                <InfoRow label="Session" value={viewApplicant.academicSession} />
                <InfoRow label="Previous School" value={viewApplicant.previousSchool} />
                <InfoRow label="Applied On" value={viewApplicant.applicationDate} />
                {viewApplicant.notes && <InfoRow label="Notes" value={viewApplicant.notes} />}
              </TabsContent>
              <TabsContent value="parent" className="space-y-1">
                <InfoRow label="Name" value={viewApplicant.parentName} />
                <InfoRow label="Phone" value={viewApplicant.parentPhone} />
                <InfoRow label="Email" value={viewApplicant.parentEmail} />
                <InfoRow label="Address" value={viewApplicant.parentAddress} />
                <InfoRow label="Relationship" value={viewApplicant.relationship} />
              </TabsContent>
              <TabsContent value="payment">
                {viewApplicant.payment ? (
                  <div className="space-y-1">
                    <InfoRow label="Amount" value={`${Number(viewApplicant.payment.amount).toLocaleString()} TZS`} />
                    <InfoRow label="Date" value={viewApplicant.payment.paymentDate} />
                    <InfoRow label="Method" value={viewApplicant.payment.paymentMethod} />
                    <InfoRow label="Receipt No." value={viewApplicant.payment.receiptNumber} />
                    <InfoRow label="Confirmed By" value={viewApplicant.payment.confirmedByName} />
                    {viewApplicant.payment.notes && <InfoRow label="Notes" value={viewApplicant.payment.notes} />}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">No payment recorded yet.</p>
                )}
              </TabsContent>
              <TabsContent value="interview">
                {viewApplicant.interview ? (
                  <div className="space-y-1">
                    <InfoRow label="Date" value={viewApplicant.interview.interviewDate} />
                    <InfoRow label="Interviewer" value={viewApplicant.interview.interviewerName} />
                    <InfoRow label="Marks" value={viewApplicant.interview.marks != null ? `${viewApplicant.interview.marks}/100` : null} />
                    <InfoRow label="Result" value={viewApplicant.interview.result} />
                    <InfoRow label="Remarks" value={viewApplicant.interview.remarks} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">No interview scheduled yet.</p>
                )}
              </TabsContent>
            </Tabs>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Payment Dialog ───────────────────────────────────────────────── */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Application Payment</DialogTitle>
            <DialogDescription>{payApplicant?.firstName} {payApplicant?.lastName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Amount (TZS) *</Label><Input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div><Label>Payment Date *</Label><Input type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} /></div>
            <div>
              <Label>Payment Method</Label>
              <Select value={payForm.payment_method} onValueChange={v => setPayForm(f => ({ ...f, payment_method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="mobile">Mobile Money</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Receipt Number</Label><Input value={payForm.receipt_number} onChange={e => setPayForm(f => ({ ...f, receipt_number: e.target.value }))} /></div>
            <div><Label>Notes</Label><Input value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          {payError && <p className="text-sm text-destructive mt-2">{payError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={submitPay} disabled={payLoading}>
              {payLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Interview Dialog ──────────────────────────────────────────────── */}
      <Dialog open={intOpen} onOpenChange={setIntOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule / Update Interview</DialogTitle>
            <DialogDescription>{intApplicant?.firstName} {intApplicant?.lastName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Interview Date *</Label><Input type="date" value={intForm.interview_date} onChange={e => setIntForm(f => ({ ...f, interview_date: e.target.value }))} /></div>
            <div>
              <Label>Interviewer</Label>
              <Select value={intForm.interviewer} onValueChange={v => setIntForm(f => ({ ...f, interviewer: v }))}>
                <SelectTrigger><SelectValue placeholder="Select staff..." /></SelectTrigger>
                <SelectContent>
                  {staffList.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {intError && <p className="text-sm text-destructive mt-2">{intError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIntOpen(false)}>Cancel</Button>
            <Button onClick={submitInterview} disabled={intLoading}>
              {intLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Result Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Interview Result</DialogTitle>
            <DialogDescription>{resultApplicant?.firstName} {resultApplicant?.lastName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Result *</Label>
              <Select value={resultForm.result} onValueChange={v => setResultForm(f => ({ ...f, result: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="accepted">Accepted (Pass)</SelectItem>
                  <SelectItem value="declined">Declined (Fail)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Marks (out of 100)</Label><Input type="number" min="0" max="100" value={resultForm.marks} onChange={e => setResultForm(f => ({ ...f, marks: e.target.value }))} /></div>
            <div>
              <Label>Remarks <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
              <Textarea
                rows={3}
                placeholder="e.g. Strong academic background, confident communicator, parents cooperative…"
                value={resultForm.remarks}
                onChange={e => setResultForm(f => ({ ...f, remarks: e.target.value }))}
              />
            </div>
          </div>
          {resultError && <p className="text-sm text-destructive mt-2">{resultError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResultOpen(false)}>Cancel</Button>
            <Button
              onClick={submitResult}
              disabled={resultLoading}
              className={resultForm.result === "accepted" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
            >
              {resultLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {resultForm.result === "accepted" ? "Accept" : "Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Enroll Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enroll as Student</DialogTitle>
            <DialogDescription>{enrollApplicant?.firstName} {enrollApplicant?.lastName} has been accepted. Complete enrolment:</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Registration Number *</Label><Input placeholder="e.g. FAMS/2026/001" value={enrollForm.reg_no} onChange={e => setEnrollForm(f => ({ ...f, reg_no: e.target.value }))} /></div>
            <div>
              <Label>Class</Label>
              <Select value={enrollForm.student_class} onValueChange={v => setEnrollForm(f => ({ ...f, student_class: v }))}>
                <SelectTrigger><SelectValue placeholder="Select class..." /></SelectTrigger>
                <SelectContent>
                  {classes.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Admission Date *</Label><Input type="date" value={enrollForm.admission_date} onChange={e => setEnrollForm(f => ({ ...f, admission_date: e.target.value }))} /></div>
          </div>
          {enrollError && <p className="text-sm text-destructive mt-2">{enrollError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollOpen(false)}>Cancel</Button>
            <Button onClick={submitEnroll} disabled={enrollLoading} className="bg-green-600 hover:bg-green-700">
              {enrollLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Enroll Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Window Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={windowOpen} onOpenChange={setWindowOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editWindow ? "Edit Application Window" : "New Application Window"}</DialogTitle>
            <DialogDescription>Set the period during which parents can submit applications online.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Academic Session *</Label><Input placeholder="e.g. 2026" value={windowForm.academic_session} onChange={e => setWindowForm(f => ({ ...f, academic_session: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Open Date *</Label><Input type="date" value={windowForm.open_date} onChange={e => setWindowForm(f => ({ ...f, open_date: e.target.value }))} /></div>
              <div><Label>Close Date *</Label><Input type="date" value={windowForm.close_date} onChange={e => setWindowForm(f => ({ ...f, close_date: e.target.value }))} /></div>
            </div>
            <div><Label>Application Fee (TZS)</Label><Input type="number" value={windowForm.application_fee} onChange={e => setWindowForm(f => ({ ...f, application_fee: e.target.value }))} /></div>
            <div><Label>Notes</Label><Input value={windowForm.notes} onChange={e => setWindowForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="active" checked={windowForm.is_active} onChange={e => setWindowForm(f => ({ ...f, is_active: e.target.checked }))} className="h-4 w-4" />
              <Label htmlFor="active" className="cursor-pointer">Window is active (parents can apply)</Label>
            </div>
          </div>
          {windowError && <p className="text-sm text-destructive mt-2">{windowError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setWindowOpen(false)}>Cancel</Button>
            <Button onClick={submitWindow} disabled={windowLoading}>
              {windowLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
