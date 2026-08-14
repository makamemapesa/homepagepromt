"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { api, getResults } from "@/lib/api-client"
import {
  Search, Plus, Edit2, Trash2, Users, UserCog, ImageIcon,
  CheckCircle2, XCircle, Quote, ArrowUpDown,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"

// ── Minimal WYSIWYG rich-text editor ─────────────────────────────────────────
function RichEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  // Sync initial value into contenteditable once on mount / when dialog re-opens
  const lastValue = useRef<string>("")
  useEffect(() => {
    if (ref.current && value !== lastValue.current) {
      ref.current.innerHTML = value
      lastValue.current = value
    }
  }, [value])

  const exec = (cmd: string, val?: string) => {
    ref.current?.focus()
    document.execCommand(cmd, false, val)
    if (ref.current) { lastValue.current = ref.current.innerHTML; onChange(ref.current.innerHTML) }
  }

  const ToolBtn = ({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" title={title} onMouseDown={e => { e.preventDefault(); onClick() }}
      className="px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-100 transition-colors">
      {children}
    </button>
  )

  return (
    <div className="border border-input rounded-md overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 px-2 py-1.5 bg-gray-50 border-b border-input">
        <ToolBtn title="Bold" onClick={() => exec("bold")}><b>B</b></ToolBtn>
        <ToolBtn title="Italic" onClick={() => exec("italic")}><em>I</em></ToolBtn>
        <ToolBtn title="Underline" onClick={() => exec("underline")}><u>U</u></ToolBtn>
        <div className="w-px bg-gray-200 mx-0.5" />
        <ToolBtn title="Bullet list" onClick={() => exec("insertUnorderedList")}>• List</ToolBtn>
        <ToolBtn title="Indent" onClick={() => exec("indent")}>→</ToolBtn>
        <div className="w-px bg-gray-200 mx-0.5" />
        <ToolBtn title="Clear formatting" onClick={() => exec("removeFormat")}>✕ Clear</ToolBtn>
      </div>
      {/* Editable area */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => { if (ref.current) { lastValue.current = ref.current.innerHTML; onChange(ref.current.innerHTML) } }}
        className="min-h-[160px] max-h-[320px] overflow-y-auto p-3 text-sm focus:outline-none prose prose-sm max-w-none"
        style={{ lineHeight: 1.7 }}
      />
    </div>
  )
}
import Image from "next/image"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

const DEPT_OPTIONS = [
  { value: "leadership",     label: "Leadership" },
  { value: "academic",       label: "Academic" },
  { value: "administration", label: "Administration" },
  { value: "support",        label: "Support Staff" },
  { value: "board",          label: "Board of Directors" },
]

type Member = {
  id: number
  firstName: string
  lastName: string
  title: string
  department: string
  bio: string
  email: string
  phone: string
  linkedinUrl: string
  photoUrl: string | null
  isActive: boolean
  order: number
}

type CEOMsg = {
  id: number
  heading: string
  body: string
  authorName: string
  authorTitle: string
  photoUrl: string | null
  isActive: boolean
}

const emptyMemberForm = {
  firstName: "", lastName: "", title: "", department: "leadership",
  bio: "", email: "", phone: "", linkedinUrl: "",
  isActive: true, order: "0",
}
const emptyCeoForm = {
  heading: "A Message from the CEO", body: "",
  authorName: "", authorTitle: "", isActive: true,
}

export default function TeamManagementPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && user && !["super_admin", "admin", "staff"].includes(user.role)) {
      router.replace("/dashboard")
    }
  }, [user, authLoading, router])

  // ── Team Members state ────────────────────────────────────────────────────
  const [members, setMembers] = useState<Member[]>([])
  const [search, setSearch] = useState("")
  const [deptFilter, setDeptFilter] = useState("all")
  const [dlgOpen, setDlgOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Member | null>(null)
  const [memberForm, setMemberForm] = useState({ ...emptyMemberForm })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [memberError, setMemberError] = useState("")
  const [memberSaving, setMemberSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const memberPhotoRef = useRef<HTMLInputElement>(null)

  // ── CEO Message state ─────────────────────────────────────────────────────
  const [ceoMsgs, setCeoMsgs] = useState<CEOMsg[]>([])
  const [ceoForm, setCeoForm] = useState({ ...emptyCeoForm })
  const [ceoEditId, setCeoEditId] = useState<number | null>(null)
  const [ceoPhotoFile, setCeoPhotoFile] = useState<File | null>(null)
  const [ceoPhotoPreview, setCeoPhotoPreview] = useState<string | null>(null)
  const [ceoError, setCeoError] = useState("")
  const [ceoSaving, setCeoSaving] = useState(false)
  const [ceoDeleteTarget, setCeoDeleteTarget] = useState<CEOMsg | null>(null)
  const [ceoDlgOpen, setCeoDlgOpen] = useState(false)
  const ceoPhotoRef = useRef<HTMLInputElement>(null)

  // ── Fetch on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !user || !["super_admin", "admin"].includes(user.role)) return
    api.get("/api/team/members/").then(r => setMembers(getResults(r.data))).catch(() => {})
    api.get("/api/team/ceo-message/").then(r => setCeoMsgs(getResults(r.data))).catch(() => {})
  }, [user, authLoading])

  // ── Member helpers ────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditTarget(null)
    setMemberForm({ ...emptyMemberForm })
    setPhotoFile(null)
    setPhotoPreview(null)
    setMemberError("")
    setDlgOpen(true)
  }

  const openEdit = (m: Member) => {
    setEditTarget(m)
    setMemberForm({
      firstName: m.firstName, lastName: m.lastName, title: m.title,
      department: m.department, bio: m.bio, email: m.email,
      phone: m.phone, linkedinUrl: m.linkedinUrl,
      isActive: m.isActive, order: String(m.order),
    })
    setPhotoFile(null)
    setPhotoPreview(m.photoUrl)
    setMemberError("")
    setDlgOpen(true)
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>, type: "member" | "ceo") => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    if (type === "member") { setPhotoFile(file); setPhotoPreview(url) }
    else { setCeoPhotoFile(file); setCeoPhotoPreview(url) }
  }

  const handleMemberSave = () => {
    if (!memberForm.firstName.trim() || !memberForm.lastName.trim()) {
      setMemberError("First name and last name are required."); return
    }
    if (!memberForm.title.trim()) { setMemberError("Title / position is required."); return }

    setMemberSaving(true)
    setMemberError("")

    const fd = new FormData()
    fd.append("first_name",   memberForm.firstName.trim())
    fd.append("last_name",    memberForm.lastName.trim())
    fd.append("title",        memberForm.title.trim())
    fd.append("department",   memberForm.department)
    fd.append("bio",          memberForm.bio.trim())
    fd.append("email",        memberForm.email.trim())
    fd.append("phone",        memberForm.phone.trim())
    fd.append("linkedin_url", memberForm.linkedinUrl.trim())
    fd.append("is_active",    String(memberForm.isActive))
    fd.append("order",        memberForm.order || "0")
    if (photoFile) fd.append("photo", photoFile)

    const req = editTarget
      ? api.patch(`/api/team/members/${editTarget.id}/`, fd, { headers: { "Content-Type": "multipart/form-data" } })
      : api.post("/api/team/members/", fd, { headers: { "Content-Type": "multipart/form-data" } })

    req
      .then(r => {
        if (editTarget) {
          setMembers(prev => prev.map(m => m.id === editTarget.id ? r.data : m))
        } else {
          setMembers(prev => [r.data, ...prev])
        }
        setDlgOpen(false)
      })
      .catch(err => setMemberError(
        err?.response?.data ? Object.values(err.response.data).flat().join(" ") : "Failed to save."
      ))
      .finally(() => setMemberSaving(false))
  }

  const handleMemberDelete = () => {
    if (!deleteTarget) return
    setDeleting(true); setDeleteError("")
    api.delete(`/api/team/members/${deleteTarget.id}/`)
      .then(() => { setMembers(prev => prev.filter(m => m.id !== deleteTarget.id)); setDeleteTarget(null) })
      .catch(() => setDeleteError("Failed to delete. Please try again."))
      .finally(() => setDeleting(false))
  }

  // ── CEO helpers ───────────────────────────────────────────────────────────
  const openNewCeo = () => {
    setCeoEditId(null)
    setCeoForm({ ...emptyCeoForm })
    setCeoPhotoFile(null); setCeoPhotoPreview(null)
    setCeoError("")
    setCeoDlgOpen(true)
  }

  const openEditCeo = (msg: CEOMsg) => {
    setCeoEditId(msg.id)
    setCeoForm({
      heading: msg.heading, body: msg.body,
      authorName: msg.authorName, authorTitle: msg.authorTitle,
      isActive: msg.isActive,
    })
    setCeoPhotoFile(null); setCeoPhotoPreview(msg.photoUrl)
    setCeoError("")
    setCeoDlgOpen(true)
  }

  const handleCeoSave = () => {
    if (!ceoForm.authorName.trim()) { setCeoError("Author name is required."); return }
    if (!ceoForm.body.trim()) { setCeoError("Message body is required."); return }

    setCeoSaving(true); setCeoError("")

    const fd = new FormData()
    fd.append("heading",      ceoForm.heading.trim())
    fd.append("body",         ceoForm.body.trim())
    fd.append("author_name",  ceoForm.authorName.trim())
    fd.append("author_title", ceoForm.authorTitle.trim())
    fd.append("is_active",    String(ceoForm.isActive))
    if (ceoPhotoFile) fd.append("photo", ceoPhotoFile)

    const req = ceoEditId
      ? api.patch(`/api/team/ceo-message/${ceoEditId}/`, fd, { headers: { "Content-Type": "multipart/form-data" } })
      : api.post("/api/team/ceo-message/", fd, { headers: { "Content-Type": "multipart/form-data" } })

    req
      .then(r => {
        if (ceoEditId) {
          setCeoMsgs(prev => prev.map(m => m.id === ceoEditId ? r.data : m))
        } else {
          setCeoMsgs(prev => [r.data, ...prev])
        }
        setCeoDlgOpen(false)
      })
      .catch(err => setCeoError(
        err?.response?.data ? Object.values(err.response.data).flat().join(" ") : "Failed to save."
      ))
      .finally(() => setCeoSaving(false))
  }

  const handleCeoDelete = () => {
    if (!ceoDeleteTarget) return
    api.delete(`/api/team/ceo-message/${ceoDeleteTarget.id}/`)
      .then(() => { setCeoMsgs(prev => prev.filter(m => m.id !== ceoDeleteTarget.id)); setCeoDeleteTarget(null) })
      .catch(() => {})
  }

  const filteredMembers = members.filter(m => {
    const q = search.toLowerCase()
    return (
      (`${m.firstName} ${m.lastName}`.toLowerCase().includes(q) || m.title.toLowerCase().includes(q)) &&
      (deptFilter === "all" || m.department === deptFilter)
    )
  })

  if (authLoading || !user) return null
  if (!["super_admin", "admin", "staff"].includes(user.role)) return null

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <DashboardHeader
        title="Team & Content"
        description="Manage team member profiles and the CEO message displayed on the public website."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Members",  value: members.length,                        icon: Users,        color: "text-blue-600",   bg: "bg-blue-500/10" },
          { label: "Active Members", value: members.filter(m => m.isActive).length, icon: CheckCircle2, color: "text-accent",     bg: "bg-accent/10" },
          { label: "Departments",    value: new Set(members.map(m => m.department)).size, icon: ArrowUpDown, color: "text-purple-600", bg: "bg-purple-500/10" },
          { label: "CEO Messages",   value: ceoMsgs.length,                        icon: Quote,        color: "text-orange-600", bg: "bg-orange-500/10" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className={`rounded-lg p-2 ${bg}`}><Icon className={`h-5 w-5 ${color}`} /></div>
              <div><p className="text-xl font-bold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="members">
        <TabsList className="mb-2">
          <TabsTrigger value="members" className="gap-2"><Users className="h-4 w-4" />Team Members</TabsTrigger>
          <TabsTrigger value="ceo" className="gap-2"><Quote className="h-4 w-4" />CEO Message</TabsTrigger>
        </TabsList>

        {/* ── TEAM MEMBERS TAB ──────────────────────────────────────────── */}
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>Add, edit, or remove staff profiles shown on the public website.</CardDescription>
                </div>
                <Button size="sm" className="gap-1" onClick={openAdd}>
                  <Plus className="h-4 w-4" />Add Member
                </Button>
              </div>
              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search by name or title…" className="pl-9"
                    value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="All Departments" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {DEPT_OPTIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="hidden sm:table-cell">Title</TableHead>
                    <TableHead className="hidden md:table-cell">Department</TableHead>
                    <TableHead className="hidden lg:table-cell">Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No team members found. Click &ldquo;Add Member&rdquo; to get started.
                      </TableCell>
                    </TableRow>
                  ) : filteredMembers.map(m => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full overflow-hidden bg-muted ring-1 ring-border flex-shrink-0">
                            {m.photoUrl ? (
                              <img src={m.photoUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                                {m.firstName.charAt(0)}{m.lastName.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{m.firstName} {m.lastName}</p>
                            <p className="text-xs text-muted-foreground sm:hidden">{m.title}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{m.title}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className="text-xs">
                          {DEPT_OPTIONS.find(d => d.value === m.department)?.label ?? m.department}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{m.order}</TableCell>
                      <TableCell>
                        <Badge variant="outline"
                          className={m.isActive ? "bg-accent/10 text-accent border-accent/30" : "bg-muted text-muted-foreground"}>
                          {m.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(m)}>
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
        </TabsContent>

        {/* ── CEO MESSAGE TAB ───────────────────────────────────────────── */}
        <TabsContent value="ceo">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>CEO / Principal Messages</CardTitle>
                  <CardDescription>
                    The active message is shown prominently at the top of the public Team page. Only one should be active at a time.
                  </CardDescription>
                </div>
                <Button size="sm" className="gap-1" onClick={openNewCeo}>
                  <Plus className="h-4 w-4" />New Message
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Author</TableHead>
                    <TableHead className="hidden sm:table-cell">Heading</TableHead>
                    <TableHead className="hidden md:table-cell">Preview</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ceoMsgs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No CEO messages yet. Click &ldquo;New Message&rdquo; to create one.
                      </TableCell>
                    </TableRow>
                  ) : ceoMsgs.map(msg => (
                    <TableRow key={msg.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full overflow-hidden bg-muted ring-1 ring-border flex-shrink-0">
                            {msg.photoUrl ? (
                              <img src={msg.photoUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center">
                                <UserCog className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{msg.authorName}</p>
                            <p className="text-xs text-muted-foreground">{msg.authorTitle}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm font-medium">{msg.heading}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-xs truncate">
                        {msg.body.replace(/<[^>]+>/g, "").slice(0, 80)}…
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline"
                          className={msg.isActive ? "bg-accent/10 text-accent border-accent/30" : "bg-muted text-muted-foreground"}>
                          {msg.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditCeo(msg)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setCeoDeleteTarget(msg)}>
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
        </TabsContent>
      </Tabs>

      {/* ── Add / Edit Member dialog ─────────────────────────────────────── */}
      <Dialog open={dlgOpen} onOpenChange={open => { setDlgOpen(open); if (!open) setMemberError("") }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Team Member" : "Add Team Member"}</DialogTitle>
            <DialogDescription>
              {editTarget ? "Update the member's profile below." : "Fill in the details to add a new team member."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Photo upload */}
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-xl overflow-hidden bg-muted ring-1 ring-border flex-shrink-0 flex items-center justify-center">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex-1">
                <Label className="mb-1.5 block">Profile Photo</Label>
                <input ref={memberPhotoRef} type="file" accept="image/*"
                  className="hidden" onChange={e => handlePhotoChange(e, "member")} />
                <Button type="button" variant="outline" size="sm"
                  onClick={() => memberPhotoRef.current?.click()}>
                  {photoPreview ? "Change Photo" : "Upload Photo"}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP. Max 5 MB.</p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>First Name *</Label>
                <Input value={memberForm.firstName}
                  onChange={e => setMemberForm(f => ({ ...f, firstName: e.target.value }))}
                  placeholder="e.g. Ahmed" />
              </div>
              <div className="grid gap-1.5">
                <Label>Last Name *</Label>
                <Input value={memberForm.lastName}
                  onChange={e => setMemberForm(f => ({ ...f, lastName: e.target.value }))}
                  placeholder="e.g. Hassan" />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Title / Position *</Label>
              <Input value={memberForm.title}
                onChange={e => setMemberForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Head of Mathematics" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Department</Label>
                <Select value={memberForm.department}
                  onValueChange={v => setMemberForm(f => ({ ...f, department: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEPT_OPTIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Display Order</Label>
                <Input type="number" min="0" value={memberForm.order}
                  onChange={e => setMemberForm(f => ({ ...f, order: e.target.value }))}
                  placeholder="0" />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Bio</Label>
              <Textarea value={memberForm.bio} rows={3}
                onChange={e => setMemberForm(f => ({ ...f, bio: e.target.value }))}
                placeholder="Short biography or description…" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Email</Label>
                <Input type="email" value={memberForm.email}
                  onChange={e => setMemberForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="staff@fams.edu" />
              </div>
              <div className="grid gap-1.5">
                <Label>Phone</Label>
                <Input value={memberForm.phone}
                  onChange={e => setMemberForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+255 XXX XXX XXX" />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>LinkedIn URL</Label>
              <Input value={memberForm.linkedinUrl}
                onChange={e => setMemberForm(f => ({ ...f, linkedinUrl: e.target.value }))}
                placeholder="https://linkedin.com/in/…" />
            </div>

            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={memberForm.isActive ? "active" : "inactive"}
                onValueChange={v => setMemberForm(f => ({ ...f, isActive: v === "active" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active – visible on public site</SelectItem>
                  <SelectItem value="inactive">Inactive – hidden from public</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {memberError && <p className="text-sm text-destructive px-1">{memberError}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgOpen(false)} disabled={memberSaving}>Cancel</Button>
            <Button onClick={handleMemberSave} disabled={memberSaving}>
              {memberSaving ? "Saving…" : editTarget ? "Save Changes" : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete member dialog ──────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) { setDeleteTarget(null); setDeleteError("") } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <strong>{deleteTarget?.firstName} {deleteTarget?.lastName}</strong> from the team.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-sm text-destructive px-1">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button onClick={handleMemberDelete} disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Removing…" : "Remove"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Add / Edit CEO Message dialog ────────────────────────────────── */}
      <Dialog open={ceoDlgOpen} onOpenChange={open => { setCeoDlgOpen(open); if (!open) setCeoError("") }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{ceoEditId ? "Edit CEO Message" : "New CEO Message"}</DialogTitle>
            <DialogDescription>
              This message will be displayed at the top of the public Team page when set to active.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* CEO Photo */}
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-xl overflow-hidden bg-muted ring-1 ring-border flex-shrink-0 flex items-center justify-center">
                {ceoPhotoPreview ? (
                  <img src={ceoPhotoPreview} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <UserCog className="h-8 w-8 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex-1">
                <Label className="mb-1.5 block">Author Photo</Label>
                <input ref={ceoPhotoRef} type="file" accept="image/*"
                  className="hidden" onChange={e => handlePhotoChange(e, "ceo")} />
                <Button type="button" variant="outline" size="sm"
                  onClick={() => ceoPhotoRef.current?.click()}>
                  {ceoPhotoPreview ? "Change Photo" : "Upload Photo"}
                </Button>
              </div>
            </div>

            <Separator />

            <div className="grid gap-1.5">
              <Label>Section Heading</Label>
              <Input value={ceoForm.heading}
                onChange={e => setCeoForm(f => ({ ...f, heading: e.target.value }))}
                placeholder="A Message from the CEO" />
            </div>

            <div className="grid gap-1.5">
              <Label>Message Body *</Label>
              <RichEditor
                value={ceoForm.body}
                onChange={html => setCeoForm(f => ({ ...f, body: html }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Author Name *</Label>
                <Input value={ceoForm.authorName}
                  onChange={e => setCeoForm(f => ({ ...f, authorName: e.target.value }))}
                  placeholder="e.g. Dr. Faruk Aktas" />
              </div>
              <div className="grid gap-1.5">
                <Label>Author Title</Label>
                <Input value={ceoForm.authorTitle}
                  onChange={e => setCeoForm(f => ({ ...f, authorTitle: e.target.value }))}
                  placeholder="e.g. Founder & CEO" />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={ceoForm.isActive ? "active" : "inactive"}
                onValueChange={v => setCeoForm(f => ({ ...f, isActive: v === "active" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active – shown on public Team page</SelectItem>
                  <SelectItem value="inactive">Inactive – hidden from public</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {ceoError && <p className="text-sm text-destructive px-1">{ceoError}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCeoDlgOpen(false)} disabled={ceoSaving}>Cancel</Button>
            <Button onClick={handleCeoSave} disabled={ceoSaving}>
              {ceoSaving ? "Saving…" : ceoEditId ? "Save Changes" : "Create Message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete CEO message dialog ─────────────────────────────────────── */}
      <AlertDialog open={!!ceoDeleteTarget} onOpenChange={o => { if (!o) setCeoDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete CEO Message?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the message by{" "}
              <strong>{ceoDeleteTarget?.authorName}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button onClick={handleCeoDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
