"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { api, getResults } from "@/lib/api-client"
import {
  Search, ArrowLeft, Heart, Users, DollarSign, CheckCircle2, Clock, XCircle,
} from "lucide-react"
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

type Fundraiser = {
  id: number
  title: string
  category: string
  goalAmount: string
  raisedAmount: string
  donorCount: number
  progressPercent: number
}

type Donation = {
  id: number
  fundraiser: number
  donorName: string
  donorEmail: string
  amount: string
  message: string
  isAnonymous: boolean
  displayName: string
  status: string
  createdAt: string
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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default function FundraiserDonorsPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [fundraiser, setFundraiser] = useState<Fundraiser | null>(null)
  const [donations, setDonations] = useState<Donation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")

  useEffect(() => {
    if (!authLoading && user && !["super_admin", "admin"].includes(user.role))
      router.replace("/dashboard")
  }, [user, authLoading, router])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    
    Promise.all([
      api.get(`/api/fundraisers/${id}/`),
      api.get(`/api/donations/?fundraiser=${id}&ordering=-created_at&limit=500`)
    ])
      .then(([frRes, donRes]) => {
        setFundraiser(convertKeys(frRes.data) as Fundraiser)
        setDonations(convertKeys(getResults(donRes.data)) as Donation[])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const updateDonationStatus = (donationId: number, status: string) => {
    setDonations(prev => prev.map(d => d.id === donationId ? { ...d, status } : d))
    api.patch(`/api/donations/${donationId}/`, { status }).catch(() => {
      // Reload on error
      api.get(`/api/donations/?fundraiser=${id}&ordering=-created_at&limit=500`)
        .then(r => setDonations(convertKeys(getResults(r.data)) as Donation[]))
        .catch(() => {})
    })
  }

  const filtered = donations.filter(d => {
    const matchSearch = d.displayName.toLowerCase().includes(search.toLowerCase()) ||
                        d.message.toLowerCase().includes(search.toLowerCase()) ||
                        d.donorEmail.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === "all" || d.status === filterStatus
    return matchSearch && matchStatus
  })

  const totalPledged = donations.reduce((s, d) => s + Number(d.amount), 0)
  const received = donations.filter(d => d.status === "received").length
  const pending = donations.filter(d => d.status === "pending").length

  if (authLoading) return null

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Custom Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/fundraisers")}
          className="h-10 w-10 mt-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Donors & Donations</h1>
          {fundraiser && (
            <p className="text-muted-foreground mt-1">
              {fundraiser.title}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor all donation submissions and update their status.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users,        label: "Total Submissions", value: donations.length, color: "bg-blue-500" },
          { icon: DollarSign,   label: "Total Pledged",     value: fmt(totalPledged), color: "bg-green-500" },
          { icon: CheckCircle2, label: "Received",          value: received, color: "bg-emerald-500" },
          { icon: Clock,        label: "Pending",           value: pending, color: "bg-amber-500" },
        ].map(({ icon: Icon, label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${color} bg-opacity-10 flex items-center justify-center flex-shrink-0`}>
                <Icon className={`h-5 w-5 ${color.replace('bg-', 'text-')}`} />
              </div>
              <div>
                <p className="text-xl font-black">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Campaign Progress */}
      {fundraiser && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Campaign Goal</p>
                <p className="text-2xl font-black">{fmt(fundraiser.raisedAmount)} / {fmt(fundraiser.goalAmount)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Progress</p>
                <p className="text-2xl font-black text-accent">{fundraiser.progressPercent}%</p>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${Math.min(fundraiser.progressPercent, 100)}%` }} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Donations Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>All Donations</CardTitle>
          <CardDescription>Review submissions and update status as donations are received.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, email, or message…" className="pl-9" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Donor</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="min-w-[200px]">Message</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(5)].map((__, j) => (
                        <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-16 text-center">
                      <Heart className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                      <p className="text-muted-foreground font-semibold">
                        {donations.length === 0 ? "No donations yet for this campaign." : "No donations match your search."}
                      </p>
                      {donations.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          When visitors submit support via the public site, they will appear here.
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ) : filtered.map(d => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div>
                        <p className="font-semibold text-sm">{d.displayName}</p>
                        {d.donorEmail && (
                          <p className="text-xs text-muted-foreground">{d.donorEmail}</p>
                        )}
                        {d.isAnonymous && (
                          <Badge variant="outline" className="text-[10px] mt-1 py-0 px-1.5">Anonymous</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-bold text-green-600">{fmt(d.amount)}</p>
                    </TableCell>
                    <TableCell className="max-w-[250px]">
                      {d.message ? (
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                          "{d.message}"
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">—</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDate(d.createdAt)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Select value={d.status} onValueChange={v => updateDonationStatus(d.id, v)}>
                        <SelectTrigger className="h-8 text-xs w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3 text-amber-500" />
                              Pending
                            </div>
                          </SelectItem>
                          <SelectItem value="received">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                              Received
                            </div>
                          </SelectItem>
                          <SelectItem value="cancelled">
                            <div className="flex items-center gap-2">
                              <XCircle className="h-3 w-3 text-red-500" />
                              Cancelled
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
