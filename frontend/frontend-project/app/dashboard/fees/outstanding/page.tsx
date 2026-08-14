"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { api, getResults } from "@/lib/api-client"
import {
  Search, AlertTriangle, Send, CheckCircle2, Clock, DollarSign, TrendingDown,
} from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"

const fmt = (n: any) => `TSh ${(Number(n) || 0).toLocaleString()}`

function overdueSeverity(days: number) {
  if (days >= 60) return { label: "Critical", class: "bg-destructive/10 text-destructive border-destructive/30" }
  if (days >= 30) return { label: "Overdue",  class: "bg-orange-500/10 text-orange-700 border-orange-400/30" }
  return { label: "Pending", class: "bg-yellow-500/10 text-yellow-700 border-yellow-400/30" }
}

export default function OutstandingPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()
  useEffect(() => {
    if (!authLoading && user && !["super_admin", "admin", "accountant"].includes(user.role)) router.replace("/dashboard")
  }, [user, authLoading, router])

  const [outstanding, setOutstanding] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [classFilter, setClassFilter] = useState("all")
  const [reminded, setReminded] = useState<(number | string)[]>([])
  const [reminderTarget, setReminderTarget] = useState<any>(null)
  const [sendingAll, setSendingAll] = useState(false)

  const sendReminder = async (s: any) => {
    if (!user || !["super_admin", "admin", "accountant"].includes(user.role)) return
    const studentName = s.student_name || s.studentName || "Student"
    const balance = s.balance ?? ((Number(s.totalFee) || 0) - (Number(s.amountPaid) || 0))
    try {
      await api.post("/api/notifications/", {
        student_id: s.student_id || s.studentId || s.id,
        title: `Fee Reminder — ${studentName}`,
        message: `Outstanding balance of TSh ${Number(balance).toLocaleString()} for ${studentName} (${s.reg_no || s.regNo || ""}).`,
        type: "warning",
      })
      setReminded(r => [...r, s.id])
    } catch {}
  }

  const sendAllReminders = async () => {
    setSendingAll(true)
    for (const s of outstanding) {
      if (!reminded.includes(s.id)) await sendReminder(s)
    }
    setSendingAll(false)
  }

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin", "accountant"].includes(user.role)) return
    api.get("/api/fees/outstanding/").then(r => setOutstanding(getResults(r.data))).catch(() => {})
  }, [user, authLoading])

  const uniqueClasses = useMemo(() =>
    Array.from(new Set(outstanding.map(s => s.class_name || s.className || s.class || "").filter(Boolean))).sort() as string[]
  , [outstanding])

  const filtered = outstanding.filter((s) => {
    const q = search.toLowerCase()
    const studentName = s.student_name || s.studentName || ""
    const regNo = s.reg_no || s.regNo || ""
    const className = s.class_name || s.className || s.class || ""
    return (
      (studentName.toLowerCase().includes(q) || regNo.toLowerCase().includes(q)) &&
      (classFilter === "all" || className === classFilter)
    )
  })

  const totalOwed    = outstanding.reduce((s, r) => s + ((Number(r.totalFee) || 0) - (Number(r.amountPaid) || 0)), 0)
  const totalStudents = outstanding.length
  const critical      = outstanding.filter((s) => (s.days_overdue || s.daysOverdue || 0) >= 60).length
  const avgCollection = outstanding.length > 0 ? Math.round(outstanding.reduce((s, r) => {
    const paid = Number(r.amountPaid) || 0
    const total = Number(r.totalFee) || 1
    return s + (paid / total) * 100
  }, 0) / outstanding.length) : 0

  if (authLoading || !user) return null
  if (!["super_admin", "admin", "accountant"].includes(user.role)) return null

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <DashboardHeader title="Outstanding Fees" description="Monitor unpaid and partially paid student fees." />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Outstanding", value: fmt(totalOwed),      icon: TrendingDown,   color: "text-destructive",  bg: "bg-destructive/10" },
          { label: "Students Owing",    value: totalStudents,        icon: AlertTriangle,  color: "text-orange-600",   bg: "bg-orange-500/10" },
          { label: "Critical Cases",    value: critical,             icon: Clock,          color: "text-yellow-600",   bg: "bg-yellow-500/10" },
          { label: "Avg. Collection",   value: `${avgCollection}%`,  icon: DollarSign,     color: "text-primary",      bg: "bg-primary/10" },
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
              <CardTitle>Outstanding Balances</CardTitle>
              <CardDescription>Students with unpaid or partially paid fees</CardDescription>
            </div>
            <Button size="sm" variant="outline" className="gap-1" disabled={sendingAll} onClick={sendAllReminders}>
              <Send className="h-4 w-4" />{sendingAll ? "Sending…" : "Send All Reminders"}
            </Button>
          </div>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search student..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="All Classes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {uniqueClasses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
                <TableHead>Balance</TableHead>
                <TableHead className="hidden md:table-cell">Collection</TableHead>
                <TableHead className="hidden lg:table-cell">Last Payment</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const studentName = s.student_name || s.studentName || "Unknown"
                const regNo = s.reg_no || s.regNo || ""
                const className = s.class_name || s.className || s.class || ""
                const balance = (Number(s.totalFee) || 0) - (Number(s.amountPaid) || 0)
                const totalFee = Number(s.totalFee) || 1
                const amountPaid = Number(s.amountPaid) || 0
                const pct = Math.round((amountPaid / totalFee) * 100)
                const daysOverdue = s.days_overdue || s.daysOverdue || 0
                const { label, class: cls } = overdueSeverity(daysOverdue)
                const sent = reminded.includes(s.id)
                const lastPayment = s.last_payment || s.lastPayment || "Never"
                
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{studentName}</p>
                        <p className="text-xs font-mono text-muted-foreground">{regNo}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell"><Badge variant="outline">{className}</Badge></TableCell>
                    <TableCell className="font-semibold text-destructive">{fmt(balance)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <Progress value={pct} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{lastPayment}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className={cls}>{label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {sent ? (
                        <span className="flex items-center justify-end gap-1 text-xs text-accent"><CheckCircle2 className="h-3.5 w-3.5" />Sent</span>
                      ) : (
                        <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={async () => { setReminderTarget(s); await sendReminder(s) }}>
                          <Send className="h-3 w-3" />Remind
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!reminderTarget} onOpenChange={(o) => { if (!o) setReminderTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reminder Notification Created</DialogTitle>
            <DialogDescription>
              A fee reminder notification has been logged for {reminderTarget?.student_name || reminderTarget?.studentName} ({reminderTarget?.reg_no || reminderTarget?.regNo}) with an outstanding balance of{" "}
              <strong>{reminderTarget ? fmt((Number(reminderTarget.totalFee) || 0) - (Number(reminderTarget.amountPaid) || 0)) : ""}</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setReminderTarget(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
