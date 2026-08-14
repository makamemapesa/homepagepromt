"use client"

import { useState, useEffect } from "react"
import { api, getResults } from "@/lib/api-client"
import { useUser } from "@/contexts/user-context"
import {
  Bell, AlertTriangle, CheckCircle2, Info, CheckCheck, Trash2, BellOff,
} from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
type Notif = { id: string | number; title: string; message: string; type: "warning" | "success" | "info"; date: string; read: boolean }

const typeIcon = (type: Notif["type"]) => {
  if (type === "warning") return <AlertTriangle className="h-5 w-5 text-yellow-500" />
  if (type === "success") return <CheckCircle2 className="h-5 w-5 text-accent" />
  return <Info className="h-5 w-5 text-blue-500" />
}

const typeBg = (type: Notif["type"]) => {
  if (type === "warning") return "bg-yellow-500/10 border-yellow-400/20"
  if (type === "success") return "bg-accent/10 border-accent/20"
  return "bg-blue-500/10 border-blue-400/20"
}

export default function NotificationsPage() {
  const { user, loading: authLoading } = useUser()
  const isAdmin = user?.role === "super_admin" || user?.role === "admin" || user?.role === "staff"
  const [notifications, setNotifications] = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState("all")
  const [readFilter, setReadFilter] = useState("all")

  useEffect(() => {
    if (authLoading || !user) return
    setLoading(true)
    api.get("/api/notifications/")
      .then(r => setNotifications(getResults<Notif>(r.data)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user, authLoading])

  const unread = notifications.filter((n) => !n.read).length

  const filtered = notifications.filter((n) => {
    return (
      (typeFilter === "all" || n.type === typeFilter) &&
      (readFilter === "all" || (readFilter === "unread" ? !n.read : n.read))
    )
  })

  const markAll = () => {
    if (!user) return
    api.post("/api/notifications/mark_all_read/").catch(() => {})
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }
  const markOne = (id: string | number) => {
    if (!user) return
    api.patch(`/api/notifications/${id}/mark_read/`).catch(() => {})
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
  }
  const dismiss = (id: string | number) => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    api.delete(`/api/notifications/${id}/dismiss/`)
      .then(() => setNotifications((prev) => prev.filter((n) => n.id !== id)))
      .catch(() => {})
  }
  const clearAll = () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    api.delete("/api/notifications/clear_all/").catch(() => {})
    setNotifications([])
  }

  if (authLoading || !user) return null

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <DashboardHeader title="Notifications" description="Stay updated with system alerts, reminders and activity." />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "All",       value: notifications.length,                                        icon: Bell,       color: "text-primary",    bg: "bg-primary/10" },
          { label: "Unread",    value: unread,                                                       icon: Bell,       color: "text-yellow-600", bg: "bg-yellow-500/10" },
          { label: "Warnings",  value: notifications.filter((n) => n.type === "warning").length,    icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-500/10" },
          { label: "Success",   value: notifications.filter((n) => n.type === "success").length,   icon: CheckCircle2, color: "text-accent",     bg: "bg-accent/10" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className={`rounded-lg p-2 ${bg}`}><Icon className={`h-5 w-5 ${color}`} /></div>
              <div><p className="text-xl font-bold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Notification List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Notification Center
                {unread > 0 && <Badge className="rounded-full text-xs px-2 py-0">{unread} new</Badge>}
              </CardTitle>
              <CardDescription>All system notifications and alerts</CardDescription>
            </div>
            <div className="flex gap-2">
              {unread > 0 && (
                <Button variant="outline" size="sm" className="gap-1" onClick={markAll}>
                  <CheckCheck className="h-4 w-4" />Mark All Read
                </Button>
              )}
              {isAdmin && (
                <Button variant="outline" size="sm" className="gap-1 text-destructive hover:text-destructive" onClick={clearAll}>
                  <Trash2 className="h-4 w-4" />Clear All
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="success">Success</SelectItem>
              </SelectContent>
            </Select>
            <Select value={readFilter} onValueChange={setReadFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
                <SelectItem value="read">Read</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border p-4 animate-pulse">
                  <div className="mt-0.5 h-5 w-5 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 rounded bg-muted" />
                    <div className="h-3 w-2/3 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <BellOff className="h-8 w-8" />
              <p className="text-sm">No notifications to display</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((n) => (
                <div key={n.id} className={`flex items-start gap-3 rounded-lg border p-4 transition-all ${n.read ? "opacity-60 bg-muted/30" : typeBg(n.type)}`}>
                  <div className="mt-0.5 shrink-0">{typeIcon(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-semibold leading-tight ${n.read ? "text-muted-foreground" : ""}`}>{n.title}</p>
                      <span className="text-xs text-muted-foreground shrink-0">{n.date}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">{n.type}</Badge>
                      {!n.read && (
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={() => markOne(n.id)}>
                          <CheckCheck className="h-3 w-3" />Mark read
                        </Button>
                      )}
                      {isAdmin && (
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive hover:text-destructive gap-1 ml-auto" onClick={() => dismiss(n.id)}>
                          <Trash2 className="h-3 w-3" />Dismiss
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
