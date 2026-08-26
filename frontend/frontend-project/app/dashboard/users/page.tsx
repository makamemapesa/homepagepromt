"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { api, getResults } from "@/lib/api-client"
import {
  Search,
  Plus,
  MoreHorizontal,
  Shield,
  UserCog,
  GraduationCap,
  Calculator,
  Users as UsersIcon,
  User,
  Filter,
  KeyRound,
  UserX,
  UserCheck,
  Edit,
  Trash2,
  X,
  Eye,
  Mail,
  Clock,
  BadgeCheck,
  AlertTriangle,
  UserPlus,
} from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const roleLabels: Record<string, string> = {
  super_admin: "Super Administrator",
  admin: "School Administrator",
  teacher: "Teacher",
  accountant: "Accountant",
  parent: "Parent",
}

const roleIcons: Record<string, React.ElementType> = {
  super_admin: Shield,
  admin: UserCog,
  teacher: GraduationCap,
  accountant: Calculator,
  parent: UsersIcon,
}

  const roleColors: Record<string, string> = {
    super_admin: "bg-primary/10 text-primary",
    admin: "bg-accent/10 text-accent",
    teacher: "bg-chart-3/10 text-chart-3",
    accountant: "bg-chart-4/10 text-chart-4",
    parent: "bg-chart-5/10 text-chart-5",
    staff: "bg-blue-500/10 text-blue-700", // New color for staff
    "Teacher": "bg-chart-3/10 text-chart-3",
    "Accountant": "bg-chart-4/10 text-chart-4",
    "Parent": "bg-chart-5/10 text-chart-5",
    "Staff": "bg-blue-500/10 text-blue-700",
  }

export default function UsersPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()
  useEffect(() => {
    if (!authLoading && user && user.role !== "super_admin" && user.role !== "admin") router.replace("/dashboard")
  }, [user, authLoading, router])

  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [usersData, setUsersData] = useState<any[]>([])
  const [usersLoading, setUsersLoading] = useState(true)

  // Add user dialog
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ first_name: "", last_name: "", email: "", role: "", password: "", parent_guardian_id: "" })
  const [addError, setAddError] = useState("")
  const [addFieldErrors, setAddFieldErrors] = useState<Record<string, string>>({})
  const [addLoading, setAddLoading] = useState(false)

  // Edit user dialog
  const [editOpen, setEditOpen] = useState(false)
  const [editUser, setEditUser] = useState<any>(null)
  const [editForm, setEditForm] = useState<any>({ first_name: "", last_name: "", email: "", role: "", is_active: true, password: "" })
  const [editError, setEditError] = useState("")
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({})
  const [editLoading, setEditLoading] = useState(false)

  // Reset password dialog
  const [resetOpen, setResetOpen] = useState(false)
  const [resetUser, setResetUser] = useState<any>(null)
  const [newPassword, setNewPassword] = useState("")
  const [resetError, setResetError] = useState("")
  const [resetLoading, setResetLoading] = useState(false)

  // Deactivate dialog
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [deactivateUser, setDeactivateUser] = useState<any>(null)
  const [deactivateLoading, setDeactivateLoading] = useState(false)
  const [deactivateError, setDeactivateError] = useState("")

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteUser, setDeleteUser] = useState<any>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  // View dialog
  const [viewOpen, setViewOpen] = useState(false)
  const [viewUser, setViewUser] = useState<any>(null)

  // Pending parents (no login account yet)
  const [pendingParents, setPendingParents] = useState<any[]>([])
  const [pendingDeleteTarget, setPendingDeleteTarget] = useState<any>(null)
  const [pendingDeleteLoading, setPendingDeleteLoading] = useState(false)

  const fetchUsers = () => {
    setUsersLoading(true)
    api.get("/api/users/").then(r => setUsersData(getResults(r.data))).catch(() => {}).finally(() => setUsersLoading(false))
  }

  const fetchPendingParents = () => {
    api.get("/api/parents/pending/").then(r => setPendingParents(r.data)).catch(() => {})
  }

  const handleDeletePendingParent = async () => {
    if (!user || user.role !== "super_admin") return
    if (!pendingDeleteTarget) return
    setPendingDeleteLoading(true)
    try {
      await api.delete(`/api/parents/pending/${pendingDeleteTarget.id}/`)
      setPendingDeleteTarget(null)
      fetchPendingParents()
      fetchUsers()
    } catch {
      setPendingDeleteTarget(null)
    } finally {
      setPendingDeleteLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading || !user) return
    if (user.role !== "super_admin") return
    fetchUsers()
    fetchPendingParents()
  }, [user, authLoading])

  const openCreateLoginForParent = (pg: any) => {
    const nameParts = (pg.fullName || "").trim().split(" ")
    const first = nameParts[0] || ""
    const last = nameParts.slice(1).join(" ") || ""
    setAddForm({ first_name: first, last_name: last, email: pg.email || "", role: "parent", password: "", parent_guardian_id: String(pg.id) })
    setAddError("")
    setAddOpen(true)
  }

  const getDisplayName = (user: any) =>
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || user.email || "Unknown"

  const filteredUsers = usersData.filter((user) => {
    const displayName = getDisplayName(user)
    const matchesSearch = displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.email || "").toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter === "all" || user.role === roleFilter
    return matchesSearch && matchesRole
  })

  const roleCounts = {
    all: usersData.length,
    super_admin: usersData.filter((u) => u.role === "super_admin").length,
    admin: usersData.filter((u) => u.role === "admin").length,
    teacher: usersData.filter((u) => u.role === "teacher").length,
    accountant: usersData.filter((u) => u.role === "accountant").length,
    parent: usersData.filter((u) => u.role === "parent").length,
    staff: usersData.filter((u) => u.role === "staff").length,
  }

  // --- CRUD HANDLERS ---

  const handleCreateUser = async () => {
    if (!user || user.role !== "super_admin") return
    setAddError("")
    if (!addForm.email || !addForm.role || !addForm.password) {
      setAddError("Email, role, and password are required.")
      return
    }
    setAddFieldErrors({})
    setAddLoading(true)
    try {
      const payload: any = { ...addForm }
      if (!payload.parent_guardian_id) delete payload.parent_guardian_id
      else payload.parent_guardian_id = Number(payload.parent_guardian_id)
      await api.post("/api/users/", payload)
      setAddOpen(false)
      setAddForm({ first_name: "", last_name: "", email: "", role: "", password: "", parent_guardian_id: "" })
      setAddFieldErrors({})
      setSearchQuery("")
      fetchUsers()
      fetchPendingParents()
    } catch (err: any) {
      const data = err?.response?.data
      if (data && typeof data === "object") {
        const fieldMap: Record<string, string> = {}
        const general: string[] = []
        for (const [key, val] of Object.entries(data)) {
          const msg = Array.isArray(val) ? (val[0] as string) : String(val)
          if (key === "email" || key === "username") fieldMap.email = msg
          else if (key === "password") fieldMap.password = msg
          else if (key === "first_name") fieldMap.first_name = msg
          else if (key === "last_name") fieldMap.last_name = msg
          else if (key === "role") fieldMap.role = msg
          else general.push(msg)
        }
        setAddFieldErrors(fieldMap)
        if (general.length) setAddError(general.join(" "))
      } else {
        setAddError("Failed to create user. Please try again.")
      }
    } finally {
      setAddLoading(false)
    }
  }

  const openEdit = (user: any) => {
    setEditUser(user)
    setEditForm({ first_name: user.firstName || "", last_name: user.lastName || "", email: user.email || "", role: user.role || "", is_active: user.isActive !== false, password: "" })
    setEditError("")
    setEditFieldErrors({})
    setEditOpen(true)
  }

  const handleEditUser = async () => {
    if (!user || user.role !== "super_admin") return
    if (!editUser) return
    setEditError("")
    if (editForm.password && editForm.password.length < 6) {
      setEditFieldErrors(fe => ({ ...fe, password: "Password must be at least 6 characters." }))
      return
    }
    setEditLoading(true)
    try {
      // Omit blank password — don't send it at all so backend ignores it
      const payload = { ...editForm }
      if (!payload.password) delete payload.password
      await api.patch(`/api/users/${editUser.id}/`, payload)
      setEditOpen(false)
      setEditFieldErrors({})
      fetchUsers()
    } catch (err: any) {
      const data = err?.response?.data
      if (data && typeof data === "object") {
        const fieldMap: Record<string, string> = {}
        const general: string[] = []
        for (const [key, val] of Object.entries(data)) {
          const msg = Array.isArray(val) ? (val[0] as string) : String(val)
          if (key === "email" || key === "username") fieldMap.email = msg
          else if (key === "first_name") fieldMap.first_name = msg
          else if (key === "last_name") fieldMap.last_name = msg
          else if (key === "role") fieldMap.role = msg
          else general.push(msg)
        }
        setEditFieldErrors(fieldMap)
        if (general.length) setEditError(general.join(" "))
      } else {
        setEditError("Failed to update user. Please try again.")
      }
    } finally {
      setEditLoading(false)
    }
  }

  const openResetPassword = (user: any) => {
    setResetUser(user)
    setNewPassword("")
    setResetError("")
    setResetOpen(true)
  }

  const handleResetPassword = async () => {
    if (!user || user.role !== "super_admin") return
    if (!resetUser) return
    setResetError("")
    if (newPassword.length < 6) {
      setResetError("Password must be at least 6 characters.")
      return
    }
    setResetLoading(true)
    try {
      await api.post(`/api/users/${resetUser.id}/reset_password/`, { password: newPassword })
      setResetOpen(false)
    } catch (err: any) {
      const data = err?.response?.data
      setResetError(data?.error || "Failed to reset password.")
    } finally {
      setResetLoading(false)
    }
  }

  const openDeactivate = (user: any) => {
    setDeactivateUser(user)
    setDeactivateOpen(true)
  }

  const handleToggleActive = async () => {
    if (!user || user.role !== "super_admin") return
    if (!deactivateUser) return
    setDeactivateLoading(true)
    setDeactivateError("")
    try {
      await api.patch(`/api/users/${deactivateUser.id}/`, { is_active: !deactivateUser.isActive })
      setDeactivateOpen(false)
      fetchUsers()
    } catch {
      setDeactivateError("Failed to update user status. Please try again.")
    } finally {
      setDeactivateLoading(false)
    }
  }

  const openDelete = (user: any) => {
    setDeleteUser(user)
    setDeleteOpen(true)
  }

  const openView = (user: any) => {
    setViewUser(user)
    setViewOpen(true)
  }

  const handleDeleteUser = async () => {
    if (!user || user.role !== "super_admin") return
    if (!deleteUser) return
    setDeleteLoading(true)
    setDeleteError("")
    try {
      await api.delete(`/api/users/${deleteUser.id}/`)
      setDeleteOpen(false)
      fetchUsers()
    } catch {
      setDeleteError("Failed to delete user. Please try again.")
    } finally {
      setDeleteLoading(false)
    }
  }

  if (authLoading || !user) return null
  if (user.role !== "super_admin") return null

  return (
    <>
      <DashboardHeader
        title="User Management"
        description="Manage all system users and their access permissions"
      />

      <div className="p-6 flex flex-col gap-6">
        {/* Pending Parent Logins */}
        {pendingParents.length > 0 && (
          <Card className="border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <CardTitle className="text-sm font-semibold text-yellow-800 dark:text-yellow-400">
                    Parents Awaiting Login Setup
                  </CardTitle>
                  <Badge variant="secondary" className="bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 text-[11px]">
                    {pendingParents.length}
                  </Badge>
                </div>
              </div>
              <CardDescription className="text-yellow-700 dark:text-yellow-500 text-xs">
                These parents were registered without a login account. Create one so they can access the parent portal.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-yellow-200 dark:divide-yellow-800">
                {pendingParents.map((pg: any) => (
                  <div key={pg.id} className="flex items-center justify-between px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-200 dark:bg-yellow-900 shrink-0">
                        <User className="h-4 w-4 text-yellow-700 dark:text-yellow-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{pg.fullName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {pg.relationship} of <span className="font-medium">{pg.studentName}</span>
                          {pg.studentRegNo && <span className="ml-1 opacity-60">({pg.studentRegNo})</span>}
                          {pg.phone && <span className="ml-2">&middot; {pg.phone}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 border-yellow-400 text-yellow-800 hover:bg-yellow-100 dark:border-yellow-700 dark:text-yellow-300 dark:hover:bg-yellow-900"
                        onClick={() => openCreateLoginForParent(pg)}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Create Login
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                        onClick={() => setPendingDeleteTarget(pg)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Role Overview Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[
            { role: "All Users", count: usersData.length, icon: UsersIcon, color: "bg-secondary text-secondary-foreground" },
            { role: "Super Admin", count: roleCounts.super_admin, icon: Shield, color: "bg-primary/10 text-primary" },
            { role: "Admin", count: roleCounts.admin, icon: UserCog, color: "bg-accent/10 text-accent" },
            { role: "Teachers", count: roleCounts.teacher, icon: GraduationCap, color: "bg-chart-3/10 text-chart-3" },
            { role: "Accountants", count: roleCounts.accountant, icon: Calculator, color: "bg-chart-4/10 text-chart-4" },
            { role: "Parents", count: roleCounts.parent, icon: UsersIcon, color: "bg-chart-5/10 text-chart-5" },
            { role: "Staff", count: roleCounts.staff, icon: UsersIcon, color: "bg-blue-500/10 text-blue-700" },
          ].map((item) => (
            <Card key={item.role} className="cursor-pointer hover:border-primary/20 transition-colors">
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.color}`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xl font-bold text-card-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                    {item.count}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{item.role}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* User Management Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold">System Users</CardTitle>
                <CardDescription>Manage user accounts and permissions</CardDescription>
              </div>

              {/* Add User Dialog */}
              <Dialog open={addOpen} onOpenChange={(open) => {
                if (!open) {
                  setAddOpen(false)
                  setAddForm({ first_name: "", last_name: "", email: "", role: "", password: "", parent_guardian_id: "" })
                  setAddError("")
                  setAddFieldErrors({})
                } else {
                  setAddOpen(true)
                }
              }}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add User</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>Add New User</DialogTitle>
                    <DialogDescription>Create a new user account with role-based access</DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col gap-4 py-4">
                    {addForm.parent_guardian_id && (
                      <div className="flex items-start gap-2 rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-800 px-3 py-2.5">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-yellow-800 dark:text-yellow-400">
                          Creating login for <strong>{addForm.first_name} {addForm.last_name}</strong> — this will link their account to the existing parent record.
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <Label>First Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Input placeholder="First name" value={addForm.first_name} onChange={e => { setAddForm(f => ({ ...f, first_name: e.target.value })); setAddFieldErrors(fe => ({ ...fe, first_name: "" })) }} className={addFieldErrors.first_name ? "border-destructive" : ""} />
                        {addFieldErrors.first_name && <p className="text-xs text-destructive">{addFieldErrors.first_name}</p>}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>Last Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Input placeholder="Last name" value={addForm.last_name} onChange={e => { setAddForm(f => ({ ...f, last_name: e.target.value })); setAddFieldErrors(fe => ({ ...fe, last_name: "" })) }} className={addFieldErrors.last_name ? "border-destructive" : ""} />
                        {addFieldErrors.last_name && <p className="text-xs text-destructive">{addFieldErrors.last_name}</p>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Email *</Label>
                      <Input type="email" placeholder="Enter email address" value={addForm.email} onChange={e => { setAddForm(f => ({ ...f, email: e.target.value })); setAddFieldErrors(fe => ({ ...fe, email: "" })) }} className={addFieldErrors.email ? "border-destructive" : ""} />
                      {addFieldErrors.email && <p className="text-xs text-destructive">{addFieldErrors.email}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Role</Label>
                      <Select value={addForm.role} onValueChange={v => { setAddForm(f => ({ ...f, role: v })); setAddFieldErrors(fe => ({ ...fe, role: "" })) }}>
                        <SelectTrigger className={addFieldErrors.role ? "border-destructive" : ""}><SelectValue placeholder="Select role" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="super_admin">Super Administrator</SelectItem>
                          <SelectItem value="admin">School Administrator</SelectItem>
                          <SelectItem value="teacher">Teacher</SelectItem>
                          <SelectItem value="accountant">Accountant</SelectItem>
                          <SelectItem value="parent">Parent</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                        </SelectContent>
                      </Select>
                      {addFieldErrors.role && <p className="text-xs text-destructive">{addFieldErrors.role}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Password</Label>
                      <PasswordInput autoComplete="new-password" placeholder="Set a password (min. 6 chars)" value={addForm.password} onChange={e => { setAddForm(f => ({ ...f, password: e.target.value })); setAddFieldErrors(fe => ({ ...fe, password: "" })) }} className={addFieldErrors.password ? "border-destructive" : ""} />
                      {addFieldErrors.password && <p className="text-xs text-destructive">{addFieldErrors.password}</p>}
                    </div>
                    {addError && <p className="text-xs text-destructive">{addError}</p>}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateUser} disabled={addLoading}>{addLoading ? "Creating..." : "Create User"}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search users by name or email..."
                  className="pl-9 pr-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-48">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="accountant">Accountant</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/50">
                    <TableHead className="text-xs font-semibold">User</TableHead>
                    <TableHead className="text-xs font-semibold">Role</TableHead>
                    <TableHead className="text-xs font-semibold hidden md:table-cell">Last Login</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 5 }).map((__, j) => (
                          <TableCell key={j}><div className="h-4 w-24 animate-pulse rounded bg-muted" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : filteredUsers.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No users found</TableCell></TableRow>
                  ) : filteredUsers.map((user) => {
                    const displayName = getDisplayName(user)
                    const displayRole = roleLabels[user.role] || user.role || ""
                    const isActive = user.isActive !== false
                    const RoleIcon = roleIcons[user.role] || User
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                                {displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium text-card-foreground">{displayName}</p>
                              <p className="text-[11px] text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`text-[11px] ${roleColors[user.role] || ""}`}>
                            <RoleIcon className="mr-1 h-3 w-3" />
                            {displayRole}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-sm text-muted-foreground">
                            {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString("en-TZ") : "Never"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`text-[11px] ${isActive ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"}`}>
                            {isActive ? "active" : "inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openView(user)}>
                                <Eye className="mr-2 h-4 w-4" /> View User
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(user)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit User
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openResetPassword(user)}>
                                <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openDeactivate(user)}>
                                {isActive
                                  ? <><UserX className="mr-2 h-4 w-4" /> Deactivate User</>
                                  : <><UserCheck className="mr-2 h-4 w-4" /> Activate User</>
                                }
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => openDelete(user)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {!usersLoading && filteredUsers.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">No users found.</div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-3">{filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""} found</p>
          </CardContent>
        </Card>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>Edit User</DialogTitle>
            <DialogDescription>
              Editing <strong>{editUser ? (getDisplayName(editUser) !== editUser?.email ? getDisplayName(editUser) : editUser?.email) : ""}</strong>
              {editUser?.email && getDisplayName(editUser) !== editUser?.email && <span className="ml-1 text-muted-foreground">({editUser.email})</span>}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>First Name</Label>
                <Input value={editForm.first_name} onChange={e => { setEditForm((f: any) => ({ ...f, first_name: e.target.value })); setEditFieldErrors(fe => ({ ...fe, first_name: "" })) }} className={editFieldErrors.first_name ? "border-destructive" : ""} />
                {editFieldErrors.first_name && <p className="text-xs text-destructive">{editFieldErrors.first_name}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Last Name</Label>
                <Input value={editForm.last_name} onChange={e => { setEditForm((f: any) => ({ ...f, last_name: e.target.value })); setEditFieldErrors(fe => ({ ...fe, last_name: "" })) }} className={editFieldErrors.last_name ? "border-destructive" : ""} />
                {editFieldErrors.last_name && <p className="text-xs text-destructive">{editFieldErrors.last_name}</p>}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Email</Label>
              <Input type="email" value={editForm.email} onChange={e => { setEditForm((f: any) => ({ ...f, email: e.target.value })); setEditFieldErrors(fe => ({ ...fe, email: "" })) }} className={editFieldErrors.email ? "border-destructive" : ""} />
              {editFieldErrors.email && <p className="text-xs text-destructive">{editFieldErrors.email}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Role</Label>
              <Select value={editForm.role} onValueChange={v => { setEditForm((f: any) => ({ ...f, role: v })); setEditFieldErrors(fe => ({ ...fe, role: "" })) }}>
                <SelectTrigger className={editFieldErrors.role ? "border-destructive" : ""}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Administrator</SelectItem>
                  <SelectItem value="admin">School Administrator</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="accountant">Accountant</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                </SelectContent>
              </Select>
              {editFieldErrors.role && <p className="text-xs text-destructive">{editFieldErrors.role}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>New Password <span className="text-muted-foreground font-normal">(leave blank to keep current)</span></Label>
              <PasswordInput
                autoComplete="new-password"
                placeholder="Min. 6 characters"
                value={editForm.password}
                onChange={e => { setEditForm((f: any) => ({ ...f, password: e.target.value })); setEditFieldErrors(fe => ({ ...fe, password: "" })) }}
                className={editFieldErrors.password ? "border-destructive" : ""}
              />
              {editFieldErrors.password && <p className="text-xs text-destructive">{editFieldErrors.password}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Account Status</Label>
              <Select value={editForm.is_active ? "active" : "inactive"} onValueChange={v => setEditForm((f: any) => ({ ...f, is_active: v === "active" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editError && <p className="text-xs text-destructive">{editError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditUser} disabled={editLoading}>{editLoading ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for <strong>{resetUser ? getDisplayName(resetUser) : ""}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>New Password</Label>
              <PasswordInput autoComplete="new-password" placeholder="Min. 6 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            {resetError && <p className="text-xs text-destructive">{resetError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={resetLoading}>{resetLoading ? "Updating..." : "Reset Password"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirm Dialog */}
      <Dialog open={deleteOpen} onOpenChange={o => { if (!o) { setDeleteOpen(false); setDeleteError("") } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>Delete User</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{deleteUser ? getDisplayName(deleteUser) : ""}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{deleteError}</p>}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={deleteLoading}>
              {deleteLoading ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pending Parent Delete Confirm Dialog */}
      <Dialog open={!!pendingDeleteTarget} onOpenChange={(open) => { if (!open) setPendingDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>Remove Guardian Record</DialogTitle>
            <DialogDescription>
              This removes the guardian record for{" "}
              <strong>{pendingDeleteTarget?.fullName}</strong>
              {pendingDeleteTarget?.studentName ? <> ({pendingDeleteTarget.studentName})</> : null}.
              Any other guardians of this student are left untouched — but if this is the student&apos;s
              only guardian, the student record is removed as well. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setPendingDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeletePendingParent} disabled={pendingDeleteLoading}>
              {pendingDeleteLoading ? "Removing…" : "Remove Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View User Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>User Details</DialogTitle>
          </DialogHeader>
          {viewUser && (() => {
            const vName = getDisplayName(viewUser)
            const vRole = roleLabels[viewUser.role] || viewUser.role || "—"
            const VIcon = roleIcons[viewUser.role] || User
            const vActive = viewUser.isActive !== false
            const initials = vName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
            return (
              <div className="flex flex-col gap-4 py-2">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="bg-primary/10 text-primary text-base font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-base font-semibold text-card-foreground" style={{ fontFamily: "var(--font-heading)" }}>{vName}</p>
                    <Badge variant="secondary" className={`mt-1 text-[11px] ${roleColors[viewUser.role] || ""}`}>
                      <VIcon className="mr-1 h-3 w-3" />{vRole}
                    </Badge>
                  </div>
                </div>
                <div className="rounded-lg border border-border divide-y divide-border">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Email</p>
                      <p className="text-sm">{viewUser.email || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <BadgeCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Account Status</p>
                      <Badge variant="secondary" className={`text-[11px] mt-0.5 ${vActive ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"}`}>
                        {vActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Last Login</p>
                      <p className="text-sm">{viewUser.lastLogin ? new Date(viewUser.lastLogin).toLocaleString("en-TZ") : "Never"}</p>
                    </div>
                  </div>
                  {viewUser.role === "parent" && (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-[11px] text-muted-foreground">Linked Student</p>
                        <p className="text-sm">{viewUser.studentName || <span className="text-muted-foreground italic">Not linked</span>}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => { setViewOpen(false); openEdit(viewUser) }}>
                    <Edit className="mr-2 h-4 w-4" /> Edit
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => { setViewOpen(false); openResetPassword(viewUser) }}>
                    <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                  </Button>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Deactivate / Activate Confirm Dialog */}
      <Dialog open={deactivateOpen} onOpenChange={o => { if (!o) { setDeactivateOpen(false); setDeactivateError("") } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>
              {deactivateUser?.isActive !== false ? "Deactivate User" : "Activate User"}
            </DialogTitle>
            <DialogDescription>
              {deactivateUser?.isActive !== false
                ? `This will prevent ${getDisplayName(deactivateUser || {})} from logging in.`
                : `This will restore login access for ${getDisplayName(deactivateUser || {})}.`}
            </DialogDescription>
          </DialogHeader>
          {deactivateError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{deactivateError}</p>}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeactivateOpen(false)}>Cancel</Button>
            <Button
              variant={deactivateUser?.isActive !== false ? "destructive" : "default"}
              onClick={handleToggleActive}
              disabled={deactivateLoading}
            >
              {deactivateLoading ? "Updating..." : deactivateUser?.isActive !== false ? "Deactivate" : "Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
