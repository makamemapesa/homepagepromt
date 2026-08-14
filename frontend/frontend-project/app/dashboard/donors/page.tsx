"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { api, getResults } from "@/lib/api-client"
import {
  Search, Plus, Edit2, Trash2, Heart, Users, DollarSign,
  CheckCircle2, Building2, User, Globe, Phone, Mail,
} from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
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
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Separator } from "@/components/ui/separator"

type Donor = {
  id: string
  name: string
  contact: string
  phone: string
  email: string
  type: "Foundation" | "Trust" | "Individual" | "NGO" | "Alumni Group"
  totalDonated: number
  activeStudents: number
  status: "active" | "inactive"
}

const fmt = (n: number) => {
  if (n >= 1_000_000) return `TSh ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `TSh ${(n / 1_000).toFixed(0)}K`
  return `TSh ${n.toLocaleString()}`
}

const fmtFull = (n: number) => `TSh ${Number(n).toLocaleString("en-TZ", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const typeIcon = (type: Donor["type"]) => {
  if (type === "Individual")   return <User className="h-4 w-4 text-blue-500" />
  if (type === "Foundation")   return <Heart className="h-4 w-4 text-pink-500" />
  if (type === "NGO")          return <Globe className="h-4 w-4 text-purple-500" />
  if (type === "Alumni Group") return <Users className="h-4 w-4 text-orange-500" />
  return <Building2 className="h-4 w-4 text-muted-foreground" />
}

const emptyForm = {
  name: "", contact: "", phone: "", email: "",
  type: "Foundation" as Donor["type"], status: "active" as Donor["status"],
  totalDonated: "0",
}

export default function DonorsPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()
  useEffect(() => {
    if (!authLoading && user && !["super_admin", "admin", "accountant"].includes(user.role)) router.replace("/dashboard")
  }, [user, authLoading, router])

  const [donors, setDonors] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Donor | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin"].includes(user.role)) return
    api.get("/api/donors/").then(r => setDonors(getResults(r.data))).catch(() => {})
  }, [user, authLoading])

  const filtered = donors.filter((d) => {
    const q = search.toLowerCase()
    return (
      (d.name.toLowerCase().includes(q) || d.contact.toLowerCase().includes(q)) &&
      (typeFilter === "all" || d.type === typeFilter) &&
      (statusFilter === "all" || d.status === statusFilter)
    )
  })

  const totalDonated    = donors.reduce((s, d) => s + parseFloat(d.totalDonated || 0), 0)
  const totalSponsored  = donors.reduce((s, d) => s + (d.activeStudents || 0), 0)
  const activeDonors    = donors.filter((d) => d.status === "active").length

  const openAdd = () => {
    setEditTarget(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (d: any) => {
    setEditTarget(d)
    setForm({ name: d.name, contact: d.contact, phone: d.phone, email: d.email, type: d.type, status: d.status, totalDonated: String(d.totalDonated || "0") })
    setDialogOpen(true)
  }

  const handleSave = () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    setFormError("")
    if (!form.name.trim()) { setFormError("Donor name is required."); return }
    if (!form.phone.trim()) { setFormError("Phone number is required."); return }
    setSaving(true)
    const payload = { ...form, totalDonated: parseFloat(form.totalDonated) || 0 }
    if (editTarget) {
      api.patch(`/api/donors/${editTarget.id}/`, payload)
        .then(r => { setDonors(prev => prev.map(d => d.id === editTarget.id ? { ...d, ...r.data } : d)); setDialogOpen(false) })
        .catch(err => setFormError(err?.response?.data ? Object.values(err.response.data).flat().join(" ") : "Failed to save."))
        .finally(() => setSaving(false))
    } else {
      api.post("/api/donors/", payload)
        .then(r => { setDonors(prev => [r.data, ...prev]); setDialogOpen(false) })
        .catch(err => setFormError(err?.response?.data ? Object.values(err.response.data).flat().join(" ") : "Failed to save."))
        .finally(() => setSaving(false))
    }
  }

  const handleDelete = () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError("")
    api.delete(`/api/donors/${deleteTarget.id}/`)
      .then(() => { setDonors(prev => prev.filter(d => d.id !== deleteTarget.id)); setDeleteTarget(null) })
      .catch(() => setDeleteError("Failed to delete donor. Please try again."))
      .finally(() => setDeleting(false))
  }
  if (authLoading || !user) return null
  if (!["super_admin", "admin", "accountant"].includes(user.role)) return null
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <DashboardHeader title="Donors & Sponsors" description="Manage all donors and scholarship sponsors supporting FISS students." />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Donors",       value: donors.length,      icon: Heart,        color: "text-pink-600",   bg: "bg-pink-500/10" },
          { label: "Active Donors",      value: activeDonors,        icon: CheckCircle2, color: "text-accent",     bg: "bg-accent/10" },
          { label: "Students Sponsored", value: totalSponsored,      icon: Users,        color: "text-blue-600",   bg: "bg-blue-500/10" },
          { label: "Total Donated",      value: fmt(totalDonated),   icon: DollarSign,   color: "text-primary",    bg: "bg-primary/10" },
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
              <CardTitle>All Donors</CardTitle>
              <CardDescription>Full list of registered donors and sponsors</CardDescription>
            </div>
            <Button size="sm" className="gap-1" onClick={openAdd}><Plus className="h-4 w-4" />Add Donor</Button>
          </div>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by name or contact..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {["Foundation","Trust","Individual","NGO","Alumni Group"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Donor / Sponsor</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead className="hidden lg:table-cell">Phone</TableHead>
                <TableHead>Students</TableHead>
                <TableHead className="hidden sm:table-cell">Total Donated</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                        {typeIcon(d.type)}
                      </div>
                      <div>
                        <p className="font-medium">{d.name}</p>
                        <p className="text-xs text-muted-foreground hidden sm:block">{d.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="outline" className="text-xs">{d.type}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{d.contact}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{d.phone}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">{d.activeStudents}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell font-medium text-primary">{fmtFull(parseFloat(d.totalDonated || 0))}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={d.status === "active" ? "bg-accent/10 text-accent border-accent/30" : "bg-muted text-muted-foreground"}>
                      {d.status === "active" ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(d)}>
                        <Trash2 className="h-4 w-4" />
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
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setFormError("") }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Donor" : "Add New Donor"}</DialogTitle>
            <DialogDescription>
              {editTarget ? "Update donor information below." : "Fill in the details of the new donor or sponsor."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Donor / Organisation Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Al-Farouq Foundation" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as Donor["type"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Foundation","Trust","Individual","NGO","Alumni Group"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as Donor["status"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Primary Contact Person *</Label>
              <Input value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} placeholder="Full name of contact person" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label><Phone className="inline h-3.5 w-3.5 mr-1" />Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+234 XXX XXX XXXX" />
              </div>
              <div className="grid gap-1.5">
                <Label><Mail className="inline h-3.5 w-3.5 mr-1" />Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label><DollarSign className="inline h-3.5 w-3.5 mr-1" />Total Donated (TSh)</Label>
              <Input type="number" min="0" value={form.totalDonated} onChange={(e) => setForm((f) => ({ ...f, totalDonated: e.target.value }))} placeholder="0" />
            </div>
          </div>
          {formError && <p className="text-sm text-destructive px-1">{formError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editTarget ? "Save Changes" : "Add Donor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteError("") } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Donor?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{deleteTarget?.name}</strong> from the donors list. Students currently linked to this donor will not be removed, but the donor association will be cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-sm text-destructive px-1">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Removing…" : "Remove"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
