"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { api, getResults } from "@/lib/api-client"
import {
  Search, Plus, Edit2, Trash2, Heart, Target, Users, CheckCircle2,
  TrendingUp, ExternalLink, ImageIcon, Eye,
} from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { Switch } from "@/components/ui/switch"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

const CATEGORY_OPTIONS = [
  { value: "building",  label: "Building & Infrastructure" },
  { value: "education", label: "Education & Scholarships" },
  { value: "orphans",   label: "Orphan Support" },
  { value: "equipment", label: "Equipment & Technology" },
  { value: "emergency", label: "Emergency Relief" },
  { value: "general",   label: "General Fundraiser" },
]
const STATUS_OPTIONS = [
  { value: "active",    label: "Active" },
  { value: "paused",    label: "Paused" },
  { value: "completed", label: "Completed" },
]
const CATEGORY_COLORS: Record<string, string> = {
  building: "#2563eb", education: "#7c3aed", orphans: "#db2777",
  equipment: "#0369a1", emergency: "#dc2626", general: "#16a34a",
}

type Fundraiser = {
  id: number
  title: string
  category: string
  shortDesc: string
  description: string
  goalAmount: string
  raisedAmount: string
  donorCount: number
  imageUrl: string | null
  status: string
  isFeatured: boolean
  startDate: string | null
  endDate: string | null
  donateUrl: string
  progressPercent: number
  order: number
}

const emptyForm = {
  title: "", category: "general", shortDesc: "", description: "",
  goalAmount: "", raisedAmount: "0", donorCount: "0",
  status: "active", isFeatured: false, startDate: "", endDate: "",
  donateUrl: "", order: "0",
}

function toCamel(s: string) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}
function convertKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(convertKeys)
  if (obj !== null && typeof obj === "object")
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [toCamel(k), convertKeys(v)])
    )
  return obj
}

function fmt(n: string | number) {
  return Number(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
    </div>
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function FundraisersManagementPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()

  const [fundraisers, setFundraisers] = useState<Fundraiser[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState("")
  const [filterStatus, setFilterStatus] = useState("all")

  // Dialog state
  const [dlgOpen, setDlgOpen]         = useState(false)
  const [editing, setEditing]         = useState<Fundraiser | null>(null)
  const [form, setForm]               = useState({ ...emptyForm })
  const [photoFile, setPhotoFile]     = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)
  const [formError, setFormError]     = useState("")
  const photoRef                      = useRef<HTMLInputElement>(null)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Fundraiser | null>(null)
  const [deleting, setDeleting]         = useState(false)
  const [deleteError, setDeleteError]   = useState("")

  useEffect(() => {
    if (!authLoading && user && !["super_admin", "admin", "staff"].includes(user.role))
      router.replace("/dashboard")
  }, [user, authLoading, router])

  const loadFundraisers = () => {
    setLoading(true)
    api.get("/api/fundraisers/?ordering=order,-created_at")
      .then(r => setFundraisers(convertKeys(getResults(r.data)) as Fundraiser[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadFundraisers() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm })
    setPhotoFile(null); setPhotoPreview(null); setFormError("")
    setDlgOpen(true)
  }

  const openEdit = (f: Fundraiser) => {
    setEditing(f)
    setForm({
      title: f.title, category: f.category, shortDesc: f.shortDesc,
      description: f.description, goalAmount: f.goalAmount, raisedAmount: f.raisedAmount,
      donorCount: String(f.donorCount), status: f.status,
      isFeatured: f.isFeatured, startDate: f.startDate ?? "", endDate: f.endDate ?? "",
      donateUrl: f.donateUrl, order: String(f.order),
    })
    setPhotoFile(null)
    setPhotoPreview(f.imageUrl)
    setFormError("")
    setDlgOpen(true)
  }

  const handleSave = () => {
    if (!form.title.trim()) { setFormError("Title is required."); return }
    if (!form.goalAmount || isNaN(Number(form.goalAmount))) { setFormError("Valid goal amount is required."); return }
    setSaving(true); setFormError("")

    const fd = new FormData()
    fd.append("title",         form.title.trim())
    fd.append("category",      form.category)
    fd.append("short_desc",    form.shortDesc.trim())
    fd.append("description",   form.description.trim())
    fd.append("goal_amount",   form.goalAmount)
    fd.append("raised_amount", form.raisedAmount || "0")
    fd.append("donor_count",   form.donorCount || "0")
    fd.append("status",        form.status)
    fd.append("is_featured",   form.isFeatured ? "true" : "false")
    fd.append("start_date",    form.startDate || "")
    fd.append("end_date",      form.endDate || "")
    fd.append("donate_url",    form.donateUrl.trim())
    fd.append("order",         form.order || "0")
    if (photoFile) fd.append("image", photoFile)

    const req = editing
      ? api.patch(`/api/fundraisers/${editing.id}/`, fd)
      : api.post("/api/fundraisers/", fd)

    req
      .then(() => { setDlgOpen(false); loadFundraisers() })
      .catch(e => setFormError(
        e.response?.data ? JSON.stringify(e.response.data) : "Failed to save. Please try again."
      ))
      .finally(() => setSaving(false))
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    setDeleting(true); setDeleteError("")
    api.delete(`/api/fundraisers/${deleteTarget.id}/`)
      .then(() => { setFundraisers(prev => prev.filter(f => f.id !== deleteTarget.id)); setDeleteTarget(null) })
      .catch(() => setDeleteError("Failed to delete. Please try again."))
      .finally(() => setDeleting(false))
  }

  const filtered = fundraisers.filter(f => {
    const matchSearch = f.title.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === "all" || f.status === filterStatus
    return matchSearch && matchStatus
  })

  const totalGoal   = fundraisers.reduce((s, f) => s + Number(f.goalAmount), 0)
  const totalRaised = fundraisers.reduce((s, f) => s + Number(f.raisedAmount), 0)
  const active      = fundraisers.filter(f => f.status === "active").length
  const completed   = fundraisers.filter(f => f.status === "completed").length

  if (authLoading) return null

  return (
    <div className="flex flex-col gap-6 p-6">
      <DashboardHeader
        title="Fundraisers"
        description="Create and manage fundraising campaigns shown on the public website."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Heart,        label: "Total Campaigns", value: fundraisers.length },
          { icon: CheckCircle2, label: "Active",          value: active },
          { icon: Target,       label: "Total Goal",      value: fmt(totalGoal) },
          { icon: TrendingUp,   label: "Total Raised",    value: fmt(totalRaised) },
        ].map(({ icon: Icon, label, value }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Icon className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-xl font-black">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle>Fundraising Campaigns</CardTitle>
              <CardDescription>Add, edit, or remove campaigns from your public website.</CardDescription>
            </div>
            <Button onClick={openCreate} className="bg-accent hover:bg-accent/90 text-white gap-2">
              <Plus className="h-4 w-4" /> New Campaign
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by title…" className="pl-9" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Donors</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(6)].map((__, j) => (
                        <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-16 text-center text-muted-foreground">
                      No campaigns found. Click &quot;New Campaign&quot; to create one.
                    </TableCell>
                  </TableRow>
                ) : filtered.map(f => {
                  const color = CATEGORY_COLORS[f.category] ?? "#16a34a"
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="max-w-[240px]">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-14 h-10 rounded-md overflow-hidden flex-shrink-0 border border-gray-100 flex items-center justify-center"
                            style={{ background: "#f0f4f8" }}
                          >
                            {f.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={f.imageUrl} alt={f.title} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="h-4 w-4 text-gray-300" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm line-clamp-1">{f.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {f.shortDesc || f.description.slice(0, 50)}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full text-white"
                          style={{ background: color }}>
                          {CATEGORY_OPTIONS.find(c => c.value === f.category)?.label ?? f.category}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-[140px]">
                        <p className="text-xs text-muted-foreground mb-1">
                          {fmt(f.raisedAmount)} / {fmt(f.goalAmount)} ({f.progressPercent}%)
                        </p>
                        <ProgressBar pct={f.progressPercent} color={color} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          {f.donorCount}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={f.status === "active" ? "default" : f.status === "completed" ? "secondary" : "outline"}
                          className={f.status === "active" ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}>
                          {f.status.charAt(0).toUpperCase() + f.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                            title="View Donors" onClick={() => router.push(`/dashboard/fundraisers/${f.id}/donors`)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {f.donateUrl && (
                            <a href={f.donateUrl} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-accent">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </a>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(f)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => { setDeleteTarget(f); setDeleteError("") }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Add / Edit Dialog ─────────────────────────────────────── */}
      <Dialog open={dlgOpen} onOpenChange={open => { setDlgOpen(open); if (!open) setFormError("") }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Campaign" : "New Fundraising Campaign"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update the details of this fundraising campaign." : "Fill in the details to create a new campaign on the public website."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Cover image */}
            <div className="grid gap-1.5">
              <Label>Cover Image</Label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-16 rounded-lg overflow-hidden border border-input flex-shrink-0 flex items-center justify-center"
                  style={{ background: "#f0f4f8" }}>
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => photoRef.current?.click()}>
                    {photoPreview ? "Change Image" : "Upload Image"}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG – max 5 MB</p>
                </div>
                <input ref={photoRef} type="file" accept="image/*" className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) { setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file)) }
                  }} />
              </div>
            </div>

            <Separator />

            {/* Title */}
            <div className="grid gap-1.5">
              <Label>Campaign Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Build Our New Classroom Block" />
            </div>

            {/* Category + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Status *</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Short description */}
            <div className="grid gap-1.5">
              <Label>Short Summary</Label>
              <Input value={form.shortDesc}
                onChange={e => setForm(f => ({ ...f, shortDesc: e.target.value }))}
                placeholder="One sentence shown on the campaign card (max 300 chars)" maxLength={300} />
            </div>

            {/* Full description */}
            <div className="grid gap-1.5">
              <Label>Full Description</Label>
              <Textarea value={form.description} rows={4}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Explain the fundraiser in detail — what it's for, how funds will be used, etc." />
            </div>

            <Separator />

            {/* Goal + Raised */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Goal Amount (USD) *</Label>
                <Input type="number" min="0" value={form.goalAmount}
                  onChange={e => setForm(f => ({ ...f, goalAmount: e.target.value }))}
                  placeholder="e.g. 25000" />
              </div>
              <div className="grid gap-1.5">
                <Label>Amount Raised (USD)</Label>
                <Input type="number" min="0" value={form.raisedAmount}
                  onChange={e => setForm(f => ({ ...f, raisedAmount: e.target.value }))}
                  placeholder="e.g. 12500" />
              </div>
            </div>

            {/* Donors + Order */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Number of Donors</Label>
                <Input type="number" min="0" value={form.donorCount}
                  onChange={e => setForm(f => ({ ...f, donorCount: e.target.value }))}
                  placeholder="0" />
              </div>
              <div className="grid gap-1.5">
                <Label>Display Order</Label>
                <Input type="number" min="0" value={form.order}
                  onChange={e => setForm(f => ({ ...f, order: e.target.value }))}
                  placeholder="0 = first" />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>End Date</Label>
                <Input type="date" value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>

            {/* Donate URL */}
            <div className="grid gap-1.5">
              <Label>Donation Link (optional)</Label>
              <Input value={form.donateUrl}
                onChange={e => setForm(f => ({ ...f, donateUrl: e.target.value }))}
                placeholder="https://paypal.me/yourlink or any payment URL" />
            </div>

            {/* Featured toggle */}
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <Switch
                checked={form.isFeatured}
                onCheckedChange={v => setForm(f => ({ ...f, isFeatured: v }))}
              />
              <div>
                <p className="text-sm font-medium">Featured Campaign</p>
                <p className="text-xs text-muted-foreground">Show this campaign prominently at the top of the fundraisers page.</p>
              </div>
            </div>
          </div>

          {formError && <p className="text-sm text-destructive px-1">{formError}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}
              className="bg-accent hover:bg-accent/90 text-white">
              {saving ? "Saving…" : editing ? "Save Changes" : "Create Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.title}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-sm text-destructive px-1">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button onClick={handleDelete} disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90">
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
