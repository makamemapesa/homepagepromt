"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api-client"
import { useUser } from "@/contexts/user-context"
import {
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
} from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

const EVENT_TYPES = ["term", "break", "exam", "event", "holiday"] as const
type EventType = typeof EVENT_TYPES[number]

const TYPE_BADGE: Record<EventType, string> = {
  term:    "bg-primary/10 text-primary",
  break:   "bg-green-500/10 text-green-700",
  exam:    "bg-destructive/10 text-destructive",
  event:   "bg-blue-500/10 text-blue-700",
  holiday: "bg-orange-500/10 text-orange-700",
}

interface CalendarEvent {
  id: number
  event: string
  date: string
  endDate: string | null
  type: EventType
  description: string
}

const EMPTY_FORM = { event: "", date: "", endDate: "", type: "event" as EventType, description: "" }

function fmt(d: string) {
  if (!d) return ""
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export default function AcademicCalendarPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState("all")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [msg, setMsg] = useState("")

  const isAdmin = user?.role === "super_admin" || user?.role === "admin"

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.replace("/login"); return }
    if (!["super_admin", "admin", "teacher", "staff"].includes(user.role)) { router.replace("/dashboard"); return }
    fetchEvents()
  }, [authLoading, user])

  function fetchEvents() {
    setLoading(true)
    api.get("/api/academic-calendar/")
      .then(res => setEvents(res.data.results ?? res.data))
      .catch(() => setMsg("Failed to load calendar events."))
      .finally(() => setLoading(false))
  }

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setMsg("")
    setDialogOpen(true)
  }

  function openEdit(ev: CalendarEvent) {
    setEditing(ev)
    setForm({ event: ev.event, date: ev.date, endDate: ev.endDate ?? "", type: ev.type, description: ev.description })
    setMsg("")
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.event.trim() || !form.date) { setMsg("Event name and date are required."); return }
    setSaving(true)
    setMsg("")
    const payload = {
      event: form.event.trim(),
      date: form.date,
      end_date: form.endDate || null,
      type: form.type,
      description: form.description.trim(),
    }
    try {
      if (editing) {
        await api.patch(`/api/academic-calendar/${editing.id}/`, payload)
      } else {
        await api.post("/api/academic-calendar/", payload)
      }
      setDialogOpen(false)
      fetchEvents()
    } catch (e: any) {
      const detail = e.response?.data
      setMsg(typeof detail === "string" ? detail : JSON.stringify(detail) || "Save failed.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    setDeleteId(id)
    try {
      await api.delete(`/api/academic-calendar/${id}/`)
      setEvents(prev => prev.filter(e => e.id !== id))
    } catch {
      setMsg("Delete failed.")
    } finally {
      setDeleteId(null)
    }
  }

  const filtered = filterType === "all" ? events : events.filter(e => e.type === filterType)
  const currentMonth = new Date().toLocaleString("en-GB", { month: "long", year: "numeric" })
  const upcoming = events.filter(e => new Date(e.date) >= new Date(new Date().toDateString())).slice(0, 5)

  if (authLoading || !user) return null

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <DashboardHeader
        title="Academic Calendar"
        description="School terms, exams, holidays and events for the academic year."
      />

      {/* Upcoming events summary */}
      {upcoming.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Upcoming Events
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {upcoming.map(ev => (
              <span
                key={ev.id}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${TYPE_BADGE[ev.type]}`}
              >
                <CalendarDays className="h-3 w-3" />
                {ev.event} — {fmt(ev.date)}
              </span>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Main table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>All Events</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {EVENT_TYPES.map(t => (
                    <SelectItem key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAdmin && (
                <Button size="sm" className="gap-1" onClick={openCreate}>
                  <Plus className="h-4 w-4" /> Add Event
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {msg && (
            <div className="mb-3 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <X className="h-4 w-4 shrink-0" />
              {msg}
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-8 w-8" />
              <p>No calendar events found.</p>
              {isAdmin && (
                <Button size="sm" variant="outline" onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1" /> Add First Event
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Description</TableHead>
                    {isAdmin && <TableHead className="w-20">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(ev => (
                    <TableRow key={ev.id}>
                      <TableCell className="font-medium">{ev.event}</TableCell>
                      <TableCell>
                        <Badge className={`${TYPE_BADGE[ev.type]} capitalize border-0`} variant="outline">
                          {ev.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{fmt(ev.date)}</TableCell>
                      <TableCell>{ev.endDate ? fmt(ev.endDate) : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {ev.description || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(ev)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(ev.id)}
                              disabled={deleteId === ev.id}
                            >
                              {deleteId === ev.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Event" : "Add Calendar Event"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ev-name">Event Name *</Label>
              <Input id="ev-name" value={form.event} onChange={e => setForm(f => ({ ...f, event: e.target.value }))} placeholder="e.g. First Term Begins" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ev-type">Type *</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as EventType }))}>
                  <SelectTrigger id="ev-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map(t => (
                      <SelectItem key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ev-date">Start Date *</Label>
                <Input id="ev-date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ev-enddate">End Date <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="ev-enddate" type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ev-desc">Description</Label>
              <Textarea id="ev-desc" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional details…" />
            </div>
            {msg && <p className="text-sm text-destructive">{msg}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save Changes" : "Add Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
