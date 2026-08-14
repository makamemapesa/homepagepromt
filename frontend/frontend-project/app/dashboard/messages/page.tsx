"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { api } from "@/lib/api-client"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
  MessageCircle, Send, CheckCheck, Circle, Search, Plus,
} from "lucide-react"

export default function MessagesPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()

  const [threads, setThreads] = useState<any[]>([])
  const [filteredThreads, setFilteredThreads] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [activeThread, setActiveThread] = useState<any>(null)
  const [threadMessages, setThreadMessages] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [msgBody, setMsgBody] = useState("")
  const [msgSending, setMsgSending] = useState(false)
  const [showNewMsg, setShowNewMsg] = useState(false)
  const [newMsgRecipient, setNewMsgRecipient] = useState("")
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (authLoading || !user) return
    const allowed = ["super_admin", "admin", "teacher", "parent"]
    if (!allowed.includes(user.role)) { router.replace("/dashboard"); return }
    const loadThreads = () =>
      api.get("/api/messages/").then(r => { setThreads(r.data ?? []); setFilteredThreads(r.data ?? []) }).catch(() => {})
    loadThreads()
    api.get("/api/messages/contacts/").then(r => setContacts(r.data ?? [])).catch(() => {})
    setLoading(false)
    // Poll for new threads every 30 seconds
    const interval = setInterval(loadThreads, 30000)
    return () => clearInterval(interval)
  }, [user, authLoading])

  useEffect(() => {
    const q = search.toLowerCase()
    setFilteredThreads(threads.filter(t => t.partnerName?.toLowerCase().includes(q)))
  }, [search, threads])

  useEffect(() => {
    if (!activeThread) return
    const loadMsgs = () =>
      api.get(`/api/messages/?thread=${activeThread.partnerId}`)
        .then(r => { setThreadMessages(r.data ?? []); setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100) })
        .catch(() => {})
    loadMsgs()
    // Poll active thread every 15 seconds
    const interval = setInterval(loadMsgs, 15000)
    return () => clearInterval(interval)
  }, [activeThread])

  const sendMessage = async (recipientId: string | number) => {
    if (!msgBody.trim()) return
    setMsgSending(true)
    try {
      await api.post("/api/messages/", { recipientId, body: msgBody.trim() })
      setMsgBody("")
      const r = await api.get(`/api/messages/?thread=${recipientId}`)
      setThreadMessages(r.data ?? [])
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
      api.get("/api/messages/").then(r2 => { setThreads(r2.data ?? []); setFilteredThreads(r2.data ?? []) }).catch(() => {})
    } catch { /* silent */ } finally { setMsgSending(false) }
  }

  const totalUnread = threads.reduce((acc, t) => acc + (t.unread || 0), 0)

  const roleColor: Record<string, string> = {
    parent: "bg-accent/10 text-accent",
    teacher: "bg-primary/10 text-primary",
    admin: "bg-chart-4/10 text-chart-4",
    super_admin: "bg-chart-3/10 text-chart-3",
  }

  if (loading || authLoading) return null

  return (
    <>
      <DashboardHeader
        title="Messages"
        description={totalUnread > 0 ? `${totalUnread} unread message${totalUnread > 1 ? "s" : ""}` : "Parent–Teacher communication"}
      />

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ height: "calc(100vh - 160px)", minHeight: "500px" }}>

          {/* ── Thread list ──────────────────────────── */}
          <Card className="flex flex-col overflow-hidden">
            <CardHeader className="pb-2 shrink-0 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-sm font-semibold">
                  Conversations
                  {totalUnread > 0 && (
                    <span className="ml-2 text-[10px] bg-destructive text-white rounded-full px-1.5 py-0.5">{totalUnread}</span>
                  )}
                </CardTitle>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setShowNewMsg(true); setActiveThread(null) }}>
                  <Plus className="h-3 w-3" /> New
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </CardHeader>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredThreads.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">No conversations yet.</p>
              )}
              {filteredThreads.map((t: any) => (
                <button
                  key={t.partnerId}
                  onClick={() => { setActiveThread(t); setShowNewMsg(false) }}
                  className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${
                    activeThread?.partnerId === t.partnerId
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold truncate">{t.partnerName}</span>
                    {t.unread > 0 && (
                      <span className="shrink-0 text-[10px] bg-destructive text-white rounded-full px-1.5 leading-5">{t.unread}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="secondary" className={`text-[10px] capitalize ${roleColor[t.partnerRole] || ""}`}>
                      {t.partnerRole?.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{t.lastMessage}</p>
                  {t.lastAt && (
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {new Date(t.lastAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </Card>

          {/* ── Message pane ─────────────────────────── */}
          <Card className="md:col-span-2 flex flex-col overflow-hidden">
            {showNewMsg ? (
              /* New message form */
              <div className="flex flex-col gap-5 p-6 flex-1">
                <div>
                  <p className="text-sm font-semibold mb-1">New Conversation</p>
                  <p className="text-xs text-muted-foreground">Choose a recipient and write your message.</p>
                </div>
                <Select value={newMsgRecipient} onValueChange={setNewMsgRecipient}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select recipient…" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        <span className="font-medium">{c.name}</span>
                        <span className="ml-2 text-muted-foreground capitalize text-xs">({c.role?.replace("_", " ")})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="Write your message…"
                  className="flex-1 resize-none min-h-[140px] text-sm"
                  value={msgBody}
                  onChange={e => setMsgBody(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setShowNewMsg(false); setMsgBody(""); setNewMsgRecipient("") }}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={!newMsgRecipient || !msgBody.trim() || msgSending}
                    onClick={() => {
                      sendMessage(newMsgRecipient).then(() => {
                        const partner = contacts.find((c: any) => String(c.id) === newMsgRecipient)
                        if (partner) setActiveThread({ partnerId: partner.id, partnerName: partner.name, partnerRole: partner.role })
                        setShowNewMsg(false); setNewMsgRecipient("")
                      })
                    }}
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    {msgSending ? "Sending…" : "Send Message"}
                  </Button>
                </div>
              </div>
            ) : activeThread ? (
              /* Conversation view */
              <>
                <CardHeader className="pb-3 shrink-0 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">
                        {activeThread.partnerName?.[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{activeThread.partnerName}</p>
                      <Badge variant="secondary" className={`text-[10px] capitalize ${roleColor[activeThread.partnerRole] || ""}`}>
                        {activeThread.partnerRole?.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {threadMessages.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">No messages yet. Say hello!</p>
                  )}
                  {threadMessages.map((m: any) => {
                    const isMe = m.senderId === user?.id
                    return (
                      <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                          isMe
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted rounded-bl-sm"
                        }`}>
                          <p className="leading-relaxed">{m.body}</p>
                          <div className={`flex items-center gap-1 mt-1 text-[10px] ${isMe ? "text-primary-foreground/60 justify-end" : "text-muted-foreground"}`}>
                            {new Date(m.createdAt).toLocaleString("en-GB", {
                              day: "2-digit", month: "short",
                              hour: "2-digit", minute: "2-digit",
                            })}
                            {isMe && (m.read ? <CheckCheck className="h-3 w-3" /> : <Circle className="h-2.5 w-2.5" />)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="shrink-0 p-3 border-t border-border flex gap-2 items-end">
                  <Textarea
                    rows={1}
                    placeholder="Type a message… (Enter to send)"
                    className="flex-1 resize-none text-sm min-h-[38px] max-h-[120px]"
                    value={msgBody}
                    onChange={e => setMsgBody(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage(activeThread.partnerId)
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-9 w-9 p-0 shrink-0"
                    disabled={!msgBody.trim() || msgSending}
                    onClick={() => sendMessage(activeThread.partnerId)}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              /* Empty state */
              <div className="flex-1 flex items-center justify-center flex-col gap-4 text-muted-foreground">
                <MessageCircle className="h-14 w-14 opacity-15" />
                <div className="text-center">
                  <p className="text-sm font-semibold">No conversation selected</p>
                  <p className="text-xs mt-1">Choose a thread on the left, or start a new message.</p>
                </div>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowNewMsg(true)}>
                  <Plus className="h-4 w-4" /> Start New Conversation
                </Button>
              </div>
            )}
          </Card>

        </div>
      </div>
    </>
  )
}
