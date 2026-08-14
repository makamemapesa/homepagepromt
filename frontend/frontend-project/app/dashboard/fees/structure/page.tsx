"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { api, getResults } from "@/lib/api-client"
import { Edit, CreditCard, TrendingUp, DollarSign, BookOpen, Plus, Trash2, Filter } from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

export default function FeeStructurePage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()
  useEffect(() => {
    if (!authLoading && user && !["super_admin", "admin", "accountant"].includes(user.role)) router.replace("/dashboard")
  }, [user, authLoading, router])

  const [fees, setFees] = useState<any[]>([])
  const [sessionFilter, setSessionFilter] = useState("all")
  const [editTarget, setEditTarget] = useState<any>(null)
  const [form, setForm] = useState({ tuition: "", boarding: "", development: "", books: "" })
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")

  // Create new fee structure
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ classLevel: "", session: "2026", tuition: "", boarding: "", development: "", books: "" })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState("")

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin", "accountant"].includes(user.role)) return
    api.get("/api/fees/structure/").then(r => setFees(getResults(r.data))).catch(() => {})
  }, [user, authLoading])

  const openEdit = (f: any) => {
    setEditTarget(f)
    setForm({ tuition: String(f.tuition), boarding: String(f.boarding), development: String(f.development), books: String(f.books) })
    setOpen(true)
  }

  const handleSave = () => {
    if (!user || !["super_admin", "admin", "accountant"].includes(user.role)) return
    if (!editTarget) return
    const tuition = parseInt(form.tuition)
    const boarding = parseInt(form.boarding)
    const development = parseInt(form.development)
    const books = parseInt(form.books)
    setSaving(true)
    setSaveError("")
    api.patch(`/api/fees/structure/${editTarget.id}/`, { tuition, boarding, development, books })
      .then(r => {
        setFees(prev => prev.map(f => f.id === editTarget.id ? { ...f, ...r.data } : f))
        setOpen(false)
      })
      .catch(err => {
        const msg = err?.response?.data ? Object.values(err.response.data).flat().join(" ") : "Failed to save."
        setSaveError(String(msg))
      })
      .finally(() => setSaving(false))
  }

  const handleCreate = () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    const payload = {
      classLevel: createForm.classLevel.trim(),
      session: createForm.session.trim(),
      tuition: parseInt(createForm.tuition) || 0,
      boarding: parseInt(createForm.boarding) || 0,
      development: parseInt(createForm.development) || 0,
      books: parseInt(createForm.books) || 0,
    }
    if (!payload.classLevel || !payload.session) { setCreateError("Class level and session are required."); return }
    setCreating(true)
    setCreateError("")
    api.post("/api/fees/structure/", payload)
      .then(r => {
        setFees(prev => [...prev, r.data])
        setCreateOpen(false)
        setCreateForm({ classLevel: "", session: "2026", tuition: "", boarding: "", development: "", books: "" })
      })
      .catch(err => {
        const msg = err?.response?.data ? Object.values(err.response.data).flat().join(" ") : "Failed to create."
        setCreateError(String(msg))
      })
      .finally(() => setCreating(false))
  }

  const handleDelete = () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    if (!deleteTarget) return
    setDeleting(true)
    api.delete(`/api/fees/structure/${deleteTarget.id}/`)
      .then(() => {
        setFees(prev => prev.filter(f => f.id !== deleteTarget.id))
        setDeleteOpen(false)
        setDeleteTarget(null)
      })
      .catch(() => {})
      .finally(() => setDeleting(false))
  }

  const fmt = (n: any) => `TSh ${(Number(n) || 0).toLocaleString()}`

  const allSessions = Array.from(new Set(fees.map((f: any) => f.session).filter(Boolean))).sort().reverse()
  const displayFees = sessionFilter === "all" ? fees : fees.filter((f: any) => f.session === sessionFilter)

  const totalRevenue = displayFees.reduce((sum: number, f: any) => sum + (Number(f.total) || 0), 0)
  const avgFee = displayFees.length > 0 ? Math.round(totalRevenue / displayFees.length) : 0
  const highestFee = displayFees.length > 0 ? Math.max(...displayFees.map((f: any) => Number(f.total) || 0)) : 0

  if (authLoading || !user) return null
  if (!["super_admin", "admin", "accountant"].includes(user.role)) return null

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <DashboardHeader title="Fee Structure" description="Manage tuition and boarding fee schedules for all class levels." />

      {(user && ["super_admin", "admin"].includes(user.role) || allSessions.length > 1) && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={sessionFilter} onValueChange={setSessionFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Sessions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sessions</SelectItem>
                {allSessions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {user && ["super_admin", "admin"].includes(user.role) && (
            <Button className="gap-1.5" onClick={() => { setCreateError(""); setCreateOpen(true) }}>
              <Plus className="h-4 w-4" />New Fee Structure
            </Button>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Class Levels",    value: displayFees.length,    icon: BookOpen,    color: "text-primary",     bg: "bg-primary/10" },
          { label: "Average Fee",     value: fmt(avgFee),    icon: DollarSign,  color: "text-accent",      bg: "bg-accent/10" },
          { label: "Highest Fee",     value: fmt(highestFee), icon: TrendingUp, color: "text-blue-600",    bg: "bg-blue-500/10" },
          { label: "Session Filter",  value: sessionFilter === "all" ? "All" : sessionFilter, icon: CreditCard,  color: "text-purple-600",  bg: "bg-purple-500/10" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className={`rounded-lg p-2 ${bg}`}><Icon className={`h-5 w-5 ${color}`} /></div>
              <div><p className="text-xl font-bold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fee Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {displayFees.map((f) => (
          <Card key={f.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{f.classLevel}</CardTitle>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">{f.session}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "Tuition",      value: f.tuition },
                { label: "Boarding",     value: f.boarding },
                { label: "Development",  value: f.development },
                { label: "Books",        value: f.books },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span>{fmt(value)}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-primary text-lg">{fmt(f.total)}</span>
              </div>
              <Button variant="outline" size="sm" className="w-full gap-1 mt-2" onClick={() => openEdit(f)}>
                <Edit className="h-3.5 w-3.5" />Edit Fees
              </Button>
              {user && ["super_admin", "admin"].includes(user.role) && (
                <Button variant="ghost" size="sm" className="w-full gap-1 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => { setDeleteTarget(f); setDeleteOpen(true) }}>
                  <Trash2 className="h-3.5 w-3.5" />Delete
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Fee Comparison Table</CardTitle>
          <CardDescription>Side-by-side comparison of fees across all class levels</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">Tuition</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Boarding</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Development</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Books</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayFees.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.classLevel}</TableCell>
                  <TableCell className="text-right">{fmt(f.tuition)}</TableCell>
                  <TableCell className="text-right hidden sm:table-cell">{fmt(f.boarding)}</TableCell>
                  <TableCell className="text-right hidden sm:table-cell">{fmt(f.development)}</TableCell>
                  <TableCell className="text-right hidden sm:table-cell">{fmt(f.books)}</TableCell>
                  <TableCell className="text-right font-semibold text-primary">{fmt(f.total)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(f)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    {user && ["super_admin", "admin"].includes(user.role) && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { setDeleteTarget(f); setDeleteOpen(true) }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={open} onOpenChange={o => { if (!o) { setOpen(false); setSaveError("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Fee Structure — {editTarget?.classLevel}</DialogTitle>
            <DialogDescription>Update the fee components for {editTarget?.classLevel}. All amounts in Tanzanian Shilling (TSh).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {(["tuition", "boarding", "development", "books"] as const).map((field) => (
              <div key={field} className="grid gap-1.5">
                <Label className="capitalize">{field} (TSh)</Label>
                <Input
                  type="number"
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  placeholder="Enter amount"
                />
              </div>
            ))}
            <div className="rounded-lg border bg-muted/40 p-3 flex justify-between font-semibold">
              <span>Computed Total</span>
              <span className="text-primary">
                {fmt(["tuition","boarding","development","books"].reduce((s, k) => s + (parseInt((form as Record<string,string>)[k]) || 0), 0))}
              </span>
            </div>
            {saveError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{saveError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={o => { if (!o) { setCreateOpen(false); setCreateError("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Fee Structure</DialogTitle>
            <DialogDescription>Add a fee schedule for a class level and academic session.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Class Level (e.g. JSS 1)</Label>
              <Input value={createForm.classLevel} onChange={e => setCreateForm(f => ({ ...f, classLevel: e.target.value }))} placeholder="e.g. JSS 1" />
            </div>
            <div className="grid gap-1.5">
              <Label>Academic Session</Label>
              <Input value={createForm.session} onChange={e => setCreateForm(f => ({ ...f, session: e.target.value }))} placeholder="e.g. 2026" />
            </div>
            {(["tuition", "boarding", "development", "books"] as const).map(field => (
              <div key={field} className="grid gap-1.5">
                <Label className="capitalize">{field} (TSh)</Label>
                <Input type="number" value={createForm[field]} onChange={e => setCreateForm(f => ({ ...f, [field]: e.target.value }))} placeholder="Enter amount" />
              </div>
            ))}
            <div className="rounded-lg border bg-muted/40 p-3 flex justify-between font-semibold">
              <span>Computed Total</span>
              <span className="text-primary">{fmt(["tuition","boarding","development","books"].reduce((s, k) => s + (parseInt((createForm as Record<string,string>)[k]) || 0), 0))}</span>
            </div>
            {createError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? "Creating…" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteOpen} onOpenChange={o => { if (!o) { setDeleteOpen(false); setDeleteTarget(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Fee Structure</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the fee structure for <strong>{deleteTarget?.classLevel}</strong> ({deleteTarget?.session})? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
