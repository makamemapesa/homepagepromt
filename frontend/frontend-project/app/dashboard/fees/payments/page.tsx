"use client"

import { useState, useEffect } from "react"
import { useUser } from "@/contexts/user-context"
import {
  Search, Plus, Download, CheckCircle2, Clock, CreditCard, Banknote, Smartphone, DollarSign, Trash2,
} from "lucide-react"
import { api, getResults } from "@/lib/api-client"
import { exportCSV, buildTermOptions } from "@/lib/utils"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

const fmt = (n: any) => `TSh ${(Number(n) || 0).toLocaleString()}`

const methodIcon = (method: string) => {
  if (method === "Bank Transfer") return <CreditCard className="h-4 w-4 text-blue-500" />
  if (method === "Cash") return <Banknote className="h-4 w-4 text-green-600" />
  return <Smartphone className="h-4 w-4 text-purple-500" />
}

const EMPTY_FORM = {
  amount: "",
  method: "Bank Transfer",
  term: "",
  receiptNo: "",
  category: "Full Payment",
  notes: "",
}

export default function PaymentsPage() {
  const { user, loading: authLoading } = useUser()
  const canWrite = user?.role === "super_admin" || user?.role === "admin" || user?.role === "accountant"
  const [payments, setPayments] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [termOptions, setTermOptions] = useState<string[]>(() => buildTermOptions("2026"))
  const [currentTerm, setCurrentTerm] = useState("Term 2, 2026")

  // student search inside dialog
  const [studentQuery, setStudentQuery] = useState("")
  const [studentResults, setStudentResults] = useState<any[]>([])
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [studentSearching, setStudentSearching] = useState(false)

  // form submission state
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  useEffect(() => {
    if (authLoading || !user) return
    api.get("/api/fees/payments/").then(r => setPayments(getResults(r.data))).catch(() => {})
    // Load settings to get current term and session for dynamic term options
    api.get("/api/settings/").then(r => {
      const d = Array.isArray(r.data) ? r.data[0] : r.data
      if (!d) return
      const session = d.academicSession || d.academic_session || "2026"
      const term = d.currentTerm || d.current_term || "Term 2"
      const fullTerm = `${term}, ${session}`
      const options = buildTermOptions(session)
      setTermOptions(options)
      setCurrentTerm(fullTerm)
      setForm(f => ({ ...f, term: f.term || fullTerm }))
    }).catch(() => {})
  }, [user, authLoading])

  // debounced student search
  useEffect(() => {
    if (!studentQuery.trim()) { setStudentResults([]); return }
    const t = setTimeout(() => {
      setStudentSearching(true)
      api.get(`/api/students/?search=${encodeURIComponent(studentQuery)}&page_size=8`)
        .then(r => setStudentResults(getResults(r.data)))
        .catch(() => setStudentResults([]))
        .finally(() => setStudentSearching(false))
    }, 300)
    return () => clearTimeout(t)
  }, [studentQuery])

  const closeDialog = () => {
    setOpen(false)
    setForm(EMPTY_FORM)
    setStudentQuery("")
    setStudentResults([])
    setSelectedStudent(null)
    setSaveError("")
  }

  const filtered = payments.filter((p) => {
    const q = search.toLowerCase()
    const studentName = p.student_name || p.studentName || ""
    const regNo = p.reg_no || p.regNo || ""
    return (
      (studentName.toLowerCase().includes(q) || regNo.toLowerCase().includes(q)) &&
      (statusFilter === "all" || p.status === statusFilter) &&
      (methodFilter === "all" || p.method === methodFilter)
    )
  })

  const confirmed = payments.filter((p) => p.status === "confirmed")
  const totalCollected = confirmed.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const pending = payments.filter((p) => p.status === "pending")
  const totalPending = pending.reduce((s, p) => s + (Number(p.amount) || 0), 0)

  const handleAdd = () => {
    if (!user || !["super_admin", "admin", "accountant"].includes(user.role)) return
    if (!selectedStudent || !form.amount) return
    setSaving(true)
    setSaveError("")
    api.post("/api/fees/payments/", {
      student: selectedStudent.id,
      amount: parseFloat(form.amount),
      date: new Date().toISOString().split("T")[0],
      method: form.method,
      term: form.term,
      receipt_no: form.receiptNo,
      category: form.category,
      notes: form.notes,
      status: "pending",
    })
      .then(r => {
        setPayments(prev => [r.data, ...prev])
        closeDialog()
      })
      .catch(err => {
        const msg = err?.response?.data ? JSON.stringify(err.response.data) : "Failed to save"
        setSaveError(msg)
      })
      .finally(() => setSaving(false))
  }

  const confirmPayment = (id: number) => {
    if (!user || !["super_admin", "admin", "accountant"].includes(user.role)) return
    setActionLoading(id)
    api.patch(`/api/fees/payments/${id}/`, { status: "confirmed" })
      .then(r => setPayments(prev => prev.map(p => p.id === id ? { ...p, status: "confirmed" } : p)))
      .catch(() => alert("Failed to confirm payment."))
      .finally(() => setActionLoading(null))
  }

  const deletePayment = (id: number) => {
    if (!user || !["super_admin", "admin", "accountant"].includes(user.role)) return
    if (!confirm("Delete this payment record? This cannot be undone.")) return
    setActionLoading(id)
    api.delete(`/api/fees/payments/${id}/`)
      .then(() => setPayments(prev => prev.filter(p => p.id !== id)))
      .catch(() => alert("Failed to delete payment."))
      .finally(() => setActionLoading(null))
  }

  if (authLoading || !user) return null

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <DashboardHeader title="Fee Payments" description="Record and track all student fee payments." />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Payments",    value: payments.length,          icon: DollarSign,   color: "text-primary",     bg: "bg-primary/10" },
          { label: "Confirmed",         value: confirmed.length,          icon: CheckCircle2, color: "text-accent",      bg: "bg-accent/10" },
          { label: "Pending",           value: pending.length,            icon: Clock,        color: "text-yellow-600",  bg: "bg-yellow-500/10" },
          { label: "Total Collected",   value: fmt(totalCollected),       icon: CreditCard,   color: "text-blue-600",    bg: "bg-blue-500/10" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className={`rounded-lg p-2 ${bg}`}><Icon className={`h-5 w-5 ${color}`} /></div>
              <div><p className="text-xl font-bold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Payment Records</CardTitle>
              <CardDescription>All fee payment transactions</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1" onClick={() => exportCSV(filtered, "payments.csv")}><Download className="h-4 w-4" />Export</Button>
              {canWrite && <Button size="sm" className="gap-1" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Record Payment</Button>}
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search student..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="All Methods" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                <SelectItem value="Online">Online</SelectItem>
                <SelectItem value="Cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead className="hidden sm:table-cell">Class</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="hidden md:table-cell">Receipt No.</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="hidden md:table-cell">Method</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead className="hidden lg:table-cell">Term</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const studentName = p.student_name || p.studentName || "Unknown"
                const regNo = p.reg_no || p.regNo || ""
                const className = p.class_name || p.className || p.class || ""
                const receiptNo = p.receipt_no || p.receiptNo || "N/A"
                
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{studentName}</p>
                        <p className="text-xs font-mono text-muted-foreground">{regNo}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell"><Badge variant="outline">{className}</Badge></TableCell>
                    <TableCell className="font-semibold text-primary">{fmt(p.amount)}</TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">{receiptNo}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className="text-xs">{p.category}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-2">{methodIcon(p.method)}{p.method}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{p.date}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{p.term}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={p.status === "confirmed" ? "bg-accent/10 text-accent border-accent/30" : "bg-yellow-500/10 text-yellow-700 border-yellow-400/30"}>
                        {p.status === "confirmed" ? "Confirmed" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canWrite && p.status === "pending" && (
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 px-2 text-xs text-accent hover:text-accent"
                            disabled={actionLoading === p.id}
                            onClick={() => confirmPayment(p.id)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Confirm
                          </Button>
                        )}
                        {canWrite && (
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                            disabled={actionLoading === p.id}
                            onClick={() => deletePayment(p.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Payment Dialog */}
      <Dialog open={open} onOpenChange={o => { if (!o) closeDialog() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record New Payment</DialogTitle>
            <DialogDescription>Search for a student, then fill in payment details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">

            {/* Student Search */}
            <div className="grid gap-1.5">
              <Label>Student</Label>
              {selectedStudent ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium">{selectedStudent.fullName}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{selectedStudent.regNo}</span>
                    <span className="ml-2 text-muted-foreground">{selectedStudent.className}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => { setSelectedStudent(null); setStudentQuery("") }}>
                    Change
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or reg. number…"
                    className="pl-9"
                    value={studentQuery}
                    onChange={e => setStudentQuery(e.target.value)}
                  />
                  {(studentResults.length > 0 || studentSearching) && (
                    <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                      {studentSearching ? (
                        <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
                      ) : (
                        studentResults.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left"
                            onClick={() => { setSelectedStudent(s); setStudentQuery(""); setStudentResults([]) }}
                          >
                            <span className="font-medium">{s.fullName}</span>
                            <span className="font-mono text-xs text-muted-foreground">{s.regNo}</span>
                            <span className="ml-auto text-xs text-muted-foreground">{s.className}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Amount (TSh)</Label>
                <Input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
              </div>
              <div className="grid gap-1.5">
                <Label>Receipt Number</Label>
                <Input value={form.receiptNo} onChange={e => setForm(f => ({ ...f, receiptNo: e.target.value }))} placeholder="e.g. RCP-011" />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Full Payment","Tuition","Boarding","Development Levy","Books & Stationery","Miscellaneous"].map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Payment Method</Label>
              <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                  <SelectItem value="Online">Online</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Term</Label>
              <Select value={form.term} onValueChange={v => setForm(f => ({ ...f, term: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {termOptions.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {saveError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{saveError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!selectedStudent || !form.amount || saving}>
              {saving ? "Saving…" : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
