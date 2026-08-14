"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { api, getResults } from "@/lib/api-client"
import { exportCSV } from "@/lib/utils"
import {
  Search, Shield, LogIn, Edit2, Plus, Trash2, Settings, AlertTriangle, Download,
} from "lucide-react"
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

type AuditAction = "LOGIN" | "CREATE" | "UPDATE" | "DELETE" | "EXPORT" | "SETTINGS"


const actionIcon = (action: AuditAction) => {
  if (action === "LOGIN")    return <LogIn   className="h-4 w-4 text-blue-500" />
  if (action === "CREATE")   return <Plus    className="h-4 w-4 text-accent" />
  if (action === "UPDATE")   return <Edit2   className="h-4 w-4 text-yellow-500" />
  if (action === "DELETE")   return <Trash2  className="h-4 w-4 text-destructive" />
  if (action === "EXPORT")   return <Download className="h-4 w-4 text-purple-500" />
  return <Settings className="h-4 w-4 text-muted-foreground" />
}

const actionBadgeClass = (action: AuditAction) => {
  if (action === "LOGIN")    return "bg-blue-500/10 text-blue-700 border-blue-400/30"
  if (action === "CREATE")   return "bg-accent/10 text-accent border-accent/30"
  if (action === "UPDATE")   return "bg-yellow-500/10 text-yellow-700 border-yellow-400/30"
  if (action === "DELETE")   return "bg-destructive/10 text-destructive border-destructive/30"
  if (action === "EXPORT")   return "bg-purple-500/10 text-purple-700 border-purple-400/30"
  return "bg-muted text-muted-foreground"
}

export default function AuditPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()
  useEffect(() => {
    if (!authLoading && user && user.role !== "super_admin" && user.role !== "admin") router.replace("/dashboard")
  }, [user, authLoading, router])

  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState("all")
  const [moduleFilter, setModuleFilter] = useState("all")

  useEffect(() => {
    if (authLoading || !user) return
    if (user.role !== "super_admin") return
    api.get("/api/audit/").then(r => setAuditLogs(getResults(r.data))).catch(() => {})
  }, [user, authLoading])

  const modules = Array.from(new Set(auditLogs.map((l) => l.module)))
  const successCount = auditLogs.filter((l) => l.status === "success").length
  const failedCount  = auditLogs.filter((l) => l.status === "failed").length

  const filtered = auditLogs.filter((l) => {
    const q = search.toLowerCase()
    return (
      (l.user.toLowerCase().includes(q) || l.detail.toLowerCase().includes(q)) &&
      (actionFilter === "all" || l.action === actionFilter) &&
      (moduleFilter === "all" || l.module === moduleFilter)
    )
  })

  if (authLoading || !user) return null
  if (user.role !== "super_admin") return null

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <DashboardHeader title="Audit Log" description="Track all system activity, user actions and security events." />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Events",    value: auditLogs.length, icon: Shield,         color: "text-primary",    bg: "bg-primary/10" },
          { label: "Successful",      value: successCount,     icon: Shield,         color: "text-accent",     bg: "bg-accent/10" },
          { label: "Failed Attempts", value: failedCount,      icon: AlertTriangle,  color: "text-destructive",bg: "bg-destructive/10" },
          { label: "Unique Users",    value: new Set(auditLogs.map((l) => l.user)).size, icon: Settings, color: "text-blue-600", bg: "bg-blue-500/10" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className={`rounded-lg p-2 ${bg}`}><Icon className={`h-5 w-5 ${color}`} /></div>
              <div><p className="text-xl font-bold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Log Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>All recorded system events — today</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => exportCSV(filtered, "audit-log.csv")}><Download className="h-4 w-4" />Export Log</Button>
          </div>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search user or detail..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="All Actions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {(["LOGIN","CREATE","UPDATE","DELETE","EXPORT","SETTINGS"] as AuditAction[]).map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="All Modules" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {modules.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden lg:table-cell">Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="hidden sm:table-cell">Module</TableHead>
                <TableHead className="hidden md:table-cell">Detail</TableHead>
                <TableHead className="hidden xl:table-cell">IP Address</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => (
                <TableRow key={log.id} className={log.status === "failed" ? "bg-destructive/5" : ""}>
                  <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">{log.timestamp}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium">{log.user}</p>
                      <p className="text-xs text-muted-foreground">{log.role}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {actionIcon(log.action)}
                      <Badge variant="outline" className={`text-xs ${actionBadgeClass(log.action)}`}>{log.action}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{log.module}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[220px] truncate">{log.detail}</TableCell>
                  <TableCell className="hidden xl:table-cell font-mono text-xs text-muted-foreground">{log.ip}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={log.status === "success" ? "bg-accent/10 text-accent border-accent/30" : "bg-destructive/10 text-destructive border-destructive/30"}>
                      {log.status === "success" ? "Success" : "Failed"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
