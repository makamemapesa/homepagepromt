"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { api } from "@/lib/api-client"
import { exportCSV, buildTermOptions } from "@/lib/utils"
import {
  Users, DollarSign, TrendingUp, BookOpen, Download, BarChart2, Loader2,
} from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts"
const fmt = (n: number) =>
  n >= 1_000_000 ? `TSh ${(n / 1_000_000).toFixed(1)}M` : `TSh ${(n ?? 0).toLocaleString()}`

export default function ReportsPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()
  const [tab, setTab] = useState("enrollment")
  const [terms, setTerms] = useState(() => buildTermOptions("2026"))
  const [selectedTerm, setSelectedTerm] = useState("Term 2, 2026")
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalStudents: 0, totalRevenue: 0, passRate: 0, attendanceRate: 0, pendingFees: 0 })
  const [enrollmentData, setEnrollmentData] = useState<any[]>([])
  const [revenueData, setRevenueData] = useState<any[]>([])
  const [performanceData, setPerformanceData] = useState<any[]>([])
  const [attendanceData, setAttendanceData] = useState<any[]>([])

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin", "teacher", "accountant"].includes(user.role)) return
    api.get("/api/settings/").then(r => {
      const d = Array.isArray(r.data) ? r.data[0] : r.data
      if (!d) return
      const session = d.academicSession || "2026"
      const term = d.currentTerm || "Term 2"
      setTerms(buildTermOptions(session))
      setSelectedTerm(`${term}, ${session}`)
    }).catch(() => {})
  }, [user, authLoading])

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin", "teacher", "accountant"].includes(user.role)) return
    setLoading(true)
    const chartsUrl = `/api/reports/charts/?term=${encodeURIComponent(selectedTerm)}`
    Promise.all([
      api.get("/api/dashboard/stats/").catch(() => null),
      api.get(chartsUrl).catch(() => null),
    ]).then(([statsRes, chartsRes]) => {
      if (statsRes) setStats(prev => ({ ...prev, ...statsRes.data }))
      if (chartsRes) {
        const d = chartsRes.data
        const perfData: any[] = d.performanceData || []
        const attData: any[] = d.attendanceData || []
        setEnrollmentData(d.enrollmentData || [])
        setRevenueData(d.revenueData || [])
        setPerformanceData(perfData)
        setAttendanceData(attData)
        setStats(prev => {
          const passRate = perfData.length > 0
            ? Math.round(perfData.reduce((s, x) => s + x.average, 0) / perfData.length)
            : prev.passRate
          const totalPresent = attData.reduce((s, x) => s + x.present, 0)
          const totalCount = attData.reduce((s, x) => s + x.present + x.absent, 0)
          const attendanceRate = totalCount > 0
            ? Math.round((totalPresent / totalCount) * 100)
            : prev.attendanceRate
          return { ...prev, passRate, attendanceRate }
        })
      }
    }).finally(() => setLoading(false))
  }, [selectedTerm, user, authLoading])



  const exportCurrentTab = () => {
    const name = selectedTerm.replace(/[^a-zA-Z0-9]/g, "-")
    if (tab === "enrollment") exportCSV(enrollmentData, `enrollment-${name}.csv`)
    else if (tab === "revenue") exportCSV(revenueData, `revenue-${name}.csv`)
    else if (tab === "performance") exportCSV(performanceData, `performance-${name}.csv`)
    else if (tab === "attendance") exportCSV(attendanceData, `attendance-${name}.csv`)
  }

  const statCards = [
    { label: "Total Students",  value: stats.totalStudents.toLocaleString(), icon: Users,      color: "text-primary",    bg: "bg-primary/10",     sub: "Currently active" },
    { label: "Total Revenue",   value: fmt(stats.totalRevenue),              icon: DollarSign,  color: "text-accent",     bg: "bg-accent/10",      sub: `Pending: ${fmt(stats.pendingFees)}` },
    { label: "Pass Rate",       value: `${stats.passRate}%`,                 icon: TrendingUp,  color: "text-blue-600",   bg: "bg-blue-500/10",    sub: `Avg score — ${selectedTerm}` },
    { label: "Attendance Rate", value: `${stats.attendanceRate}%`,           icon: BookOpen,    color: "text-orange-600", bg: "bg-orange-500/10",  sub: "Based on last 30 days" },
  ]
  if (authLoading || !user) return null
  if (![ "super_admin", "admin", "teacher", "accountant"].includes(user.role)) { router.replace("/dashboard"); return null }
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <DashboardHeader title="Reports & Analytics" description="School-wide performance, enrollment, revenue and attendance insights." />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, color, bg, sub }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className={`rounded-lg p-2 ${bg}`}><Icon className={`h-5 w-5 ${color}`} /></div>
              <div><p className="text-xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p><p className="text-xs text-muted-foreground">{sub}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabbed Charts */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="enrollment">Enrollment</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Select value={selectedTerm} onValueChange={setSelectedTerm}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {terms.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1" onClick={exportCurrentTab} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export
            </Button>
          </div>
        </div>

        {/* Enrollment Tab */}
        <TabsContent value="enrollment">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Student Enrollment Trend</CardTitle>
                  <CardDescription>Total student count over the past 6 months</CardDescription>
                </div>
                <BarChart2 className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {enrollmentData.length === 0 ? (
                <div className="flex items-center justify-center h-80 text-sm text-muted-foreground">
                  {loading ? "Loading…" : "No enrollment data available."}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={enrollmentData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => [v, "Students"]} />
                    <Line type="monotone" dataKey="students" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <div className="mt-4 grid grid-cols-3 gap-4">
            {[
              { label: "Start of Year",  value: enrollmentData.length > 0 ? enrollmentData[0].students : "—" },
              { label: "Current",        value: enrollmentData.length > 0 ? enrollmentData[enrollmentData.length - 1].students : "—" },
              { label: "Growth",         value: enrollmentData.length > 0 ? `+${enrollmentData[enrollmentData.length - 1].students - enrollmentData[0].students}` : "—" },
            ].map(({ label, value }) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Revenue vs Pending Fees</CardTitle>
                  <CardDescription>Monthly collected vs outstanding fee breakdown</CardDescription>
                </div>
                <BarChart2 className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {revenueData.length === 0 ? (
                <div className="flex items-center justify-center h-80 text-sm text-muted-foreground">
                  {loading ? "Loading…" : "No revenue data available."}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={revenueData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => [`TSh ${(v as number).toLocaleString()}`, ""]} />
                    <Legend />
                    <Bar dataKey="collected" name="Collected" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pending" name="Pending" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <div className="mt-4 grid grid-cols-2 gap-4">
            {[
              { label: "Total Collected", value: fmt(stats.totalRevenue), color: "text-primary" },
              { label: "Pending Fees",    value: fmt(stats.pendingFees),  color: "text-destructive" },
            ].map(({ label, value, color }) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Subject Performance</CardTitle>
                  <CardDescription>Average scores across all subjects</CardDescription>
                </div>
                <BarChart2 className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {performanceData.length === 0 ? (
                <div className="flex items-center justify-center h-80 text-sm text-muted-foreground">
                  {loading ? "Loading…" : `No performance data for ${selectedTerm}.`}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={performanceData} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="subject" tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => [`${v}%`, "Avg Score"]} />
                    <Bar dataKey="average" name="Average Score" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <div className="mt-4 grid grid-cols-3 gap-4">
            {[
              { label: "Highest Subject", value: performanceData.length > 0 ? [...performanceData].sort((a, b) => b.average - a.average)[0]?.subject || "—" : "—" },
              { label: "School Average",  value: performanceData.length > 0 ? `${Math.round(performanceData.reduce((s, d) => s + d.average, 0) / performanceData.length)}%` : "—" },
              { label: "Lowest Subject",  value: performanceData.length > 0 ? [...performanceData].sort((a, b) => a.average - b.average)[0]?.subject || "—" : "—" },
            ].map(({ label, value }) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-lg font-bold">{value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Weekly Attendance</CardTitle>
                  <CardDescription>Present vs absent count per weekday</CardDescription>
                </div>
                <BarChart2 className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {attendanceData.length === 0 ? (
                <div className="flex items-center justify-center h-80 text-sm text-muted-foreground">
                  {loading ? "Loading…" : "No attendance data available for the last 30 days."}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={attendanceData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="present" name="Present" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="absent"  name="Absent"  fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <div className="mt-4 grid grid-cols-3 gap-4">
            {[
              { label: "Best Day",    value: attendanceData.length > 0 ? [...attendanceData].sort((a, b) => b.present - a.present)[0]?.day || "—" : "—" },
              { label: "Avg Present", value: attendanceData.length > 0 ? Math.round(attendanceData.reduce((s, d) => s + d.present, 0) / attendanceData.length) : "—" },
              { label: "Avg Absent",  value: attendanceData.length > 0 ? Math.round(attendanceData.reduce((s, d) => s + d.absent, 0) / attendanceData.length) : "—" },
            ].map(({ label, value }) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
