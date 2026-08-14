"use client"

import { useEffect, useState } from "react"
import {
  Users,
  GraduationCap,
  CreditCard,
  TrendingUp,
  TrendingDown,
  BookOpen,
  UserPlus,
  Clock,
  ArrowUpRight,
  ChevronRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { DashboardHeader } from "@/components/dashboard-header"
import Link from "next/link"
import { api, getResults } from "@/lib/api-client"
import { useUser } from "@/contexts/user-context"

const CHART_COLORS = [
  "oklch(0.35 0.12 250)",
  "oklch(0.65 0.18 155)",
  "oklch(0.70 0.15 45)",
  "oklch(0.55 0.15 300)",
]

function StatCard({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  suffix,
}: {
  title: string
  value: string
  change: string
  changeType: "up" | "down"
  icon: React.ElementType
  suffix?: string
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </span>
            <span className="text-2xl font-bold text-card-foreground" style={{ fontFamily: "var(--font-heading)" }}>
              {value}
              {suffix && <span className="text-sm font-normal text-muted-foreground ml-0.5">{suffix}</span>}
            </span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          {changeType === "up" ? (
            <TrendingUp className="h-3.5 w-3.5 text-accent" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-destructive" />
          )}
          <span
            className={`text-xs font-medium ${
              changeType === "up" ? "text-accent" : "text-destructive"
            }`}
          >
            {change}
          </span>
          <span className="text-xs text-muted-foreground">vs last term</span>
        </div>
      </CardContent>
    </Card>
  )
}

function QuickAction({ icon: Icon, label, href }: { icon: React.ElementType; label: string; href: string }) {
  return (
    <Link href={href}>
      <Button variant="outline" className="flex h-auto flex-col items-center gap-2 p-4 w-full hover:border-primary/30 hover:bg-primary/5 transition-all">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <span className="text-xs font-medium text-center text-card-foreground">{label}</span>
      </Button>
    </Link>
  )
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useUser()
  const role = user?.role
  const [statsData, setStatsData] = useState({ totalStudents: 0, totalTeachers: 0, totalClasses: 0, totalRevenue: 0, pendingFees: 0, attendanceRate: 0 })
  const [recentStudents, setRecentStudents] = useState<any[]>([])
  const [recentPayments, setRecentPayments] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [enrollmentData, setEnrollmentData] = useState<any[]>([])
  const [revenueData, setRevenueData] = useState<any[]>([])
  const [performanceData, setPerformanceData] = useState<any[]>([])
  const [attendanceData, setAttendanceData] = useState<any[]>([])
  const [feeDistribution, setFeeDistribution] = useState([
    { name: "Paid",    value: 0, color: CHART_COLORS[1] },
    { name: "Partial", value: 0, color: CHART_COLORS[2] },
    { name: "Unpaid",  value: 0, color: "oklch(0.55 0.22 25)" },
  ])

  useEffect(() => {
    if (authLoading || !user) return
    // Fetch only if user has a role that can access dashboard data
    if (user.role === "parent" || user.role === "staff") return

    api.get("/api/dashboard/stats/").then(r => setStatsData(prev => ({ ...prev, ...r.data }))).catch(() => {})
    api.get("/api/students/?page_size=5").then(r => setRecentStudents(getResults(r.data))).catch(() => {})
    api.get("/api/fees/payments/?page_size=5").then(r => setRecentPayments(getResults(r.data))).catch(() => {})
    api.get("/api/notifications/?page_size=5").then(r => setNotifications(getResults(r.data))).catch(() => {})
    // Compute fee distribution from real student fee_status counts
    api.get("/api/students/?page_size=1000&status=active").then(r => {
      const all = getResults(r.data)
      const total = all.length || 1
      const paid = all.filter((s: any) => (s.fee_status || s.feeStatus) === "paid").length
      const partial = all.filter((s: any) => (s.fee_status || s.feeStatus) === "partial").length
      const unpaid = total - paid - partial
      setFeeDistribution([
        { name: "Paid",    value: Math.round((paid / total) * 100),    color: CHART_COLORS[1] },
        { name: "Partial", value: Math.round((partial / total) * 100), color: CHART_COLORS[2] },
        { name: "Unpaid",  value: Math.round((unpaid / total) * 100),  color: "oklch(0.55 0.22 25)" },
      ])
    }).catch(() => {})
    api.get("/api/reports/charts/").then(r => {
      const d = r.data
      const attData: any[] = d.attendanceData || []
      setEnrollmentData(d.enrollmentData || [])
      setRevenueData(d.revenueData || [])
      setPerformanceData(d.performanceData || [])
      setAttendanceData(attData)
      const totalPresent = attData.reduce((s: number, x: any) => s + x.present, 0)
      const totalCount = attData.reduce((s: number, x: any) => s + x.present + x.absent, 0)
      if (totalCount > 0) {
        setStatsData(prev => ({ ...prev, attendanceRate: Math.round((totalPresent / totalCount) * 100) }))
      }
    }).catch(() => {})
  }, [user, authLoading])

  if (authLoading || !user) return null

  return (
    <>
      <DashboardHeader title="Dashboard" description="Welcome back. Here is an overview of your school." />

      <div className="p-6 flex flex-col gap-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Students"
            value={statsData.totalStudents.toLocaleString()}
            change="Active enrollment"
            changeType="up"
            icon={GraduationCap}
          />
          <StatCard
            title="Total Teachers"
            value={statsData.totalTeachers.toString()}
            change="Teaching staff"
            changeType="up"
            icon={Users}
          />
          <StatCard
            title="Fee Collection"
            value={`${(statsData.totalRevenue / 1_000_000).toFixed(1)}M`}
            change={statsData.pendingFees > 0 ? `Pending: TSh ${(statsData.pendingFees / 1_000_000).toFixed(1)}M` : "All collected"}
            changeType={statsData.pendingFees > 0 ? "down" : "up"}
            icon={CreditCard}
            suffix="TZS"
          />
          <StatCard
            title="Attendance Rate"
            value={`${statsData.attendanceRate}%`}
            change="Based on last 30 days"
            changeType={statsData.attendanceRate >= 75 ? "up" : "down"}
            icon={Clock}
          />
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {(role === "super_admin" || role === "admin") && (
                <QuickAction icon={UserPlus} label="Register Student" href="/dashboard/students/register" />
              )}
              {(role === "super_admin" || role === "admin" || role === "teacher") && (
                <QuickAction icon={BookOpen} label="Enter Marks" href="/dashboard/exams/marks" />
              )}
              {(role === "super_admin" || role === "admin" || role === "accountant" || role === "parent") && (
                <QuickAction icon={CreditCard} label="Record Payment" href="/dashboard/fees/payments" />
              )}
              {(role === "super_admin" || role === "admin" || role === "teacher" || role === "parent") && (
                <QuickAction icon={GraduationCap} label="View Results" href="/dashboard/exams/results" />
              )}
              {role === "super_admin" && (
                <QuickAction icon={Users} label="Manage Users" href="/dashboard/users" />
              )}
              {(role === "super_admin" || role === "admin" || role === "teacher" || role === "accountant") && (
                <QuickAction icon={TrendingUp} label="View Reports" href="/dashboard/reports" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Charts Row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Enrollment Trend */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Enrollment Trend</CardTitle>
                  <CardDescription>Student enrollment over the past 6 months</CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs">
                  <TrendingUp className="mr-1 h-3 w-3" /> +5.7%
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={enrollmentData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.01 240)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="oklch(0.50 0.02 250)" />
                    <YAxis tick={{ fontSize: 12 }} stroke="oklch(0.50 0.02 250)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "oklch(1 0 0)",
                        border: "1px solid oklch(0.90 0.01 240)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="students"
                      stroke={CHART_COLORS[0]}
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: CHART_COLORS[0] }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Revenue Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Revenue Overview</CardTitle>
                  <CardDescription>Fee collection vs outstanding balances (TZS)</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.01 240)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="oklch(0.50 0.02 250)" />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      stroke="oklch(0.50 0.02 250)"
                      tickFormatter={(val) => `${(val / 1_000_000).toFixed(0)}M`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "oklch(1 0 0)",
                        border: "1px solid oklch(0.90 0.01 240)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: number) => [`TSh ${(value / 1_000_000).toFixed(1)}M`, ""]}
                    />
                    <Bar dataKey="collected" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} name="Collected" />
                    <Bar dataKey="pending" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} name="Pending" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Second Charts Row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Fee Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Fee Payment Status</CardTitle>
              <CardDescription>Distribution of fee payment across students</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center">
                <div className="h-48 w-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={feeDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {feeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {feeDistribution.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-card-foreground">{item.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Subject Performance */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Subject Performance</CardTitle>
                  <CardDescription>Average scores by subject this term</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {performanceData.map((subject) => (
                  <div key={subject.subject} className="flex items-center gap-4">
                    <span className="w-24 text-sm text-muted-foreground shrink-0">{subject.subject}</span>
                    <div className="flex-1">
                      <Progress value={subject.average} className="h-2.5" />
                    </div>
                    <span className="w-10 text-sm font-semibold text-right text-card-foreground">{subject.average}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tables Row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent Students */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Recent Students</CardTitle>
                <Link href="/dashboard/students">
                  <Button variant="ghost" size="sm" className="text-xs text-primary">
                    View All <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Student</TableHead>
                    <TableHead className="text-xs">Class</TableHead>
                    <TableHead className="text-xs">Fee Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentStudents.slice(0, 5).map((student) => {
                    const fullName = student.full_name || student.fullName || `${student.first_name || student.firstName || ""} ${student.last_name || student.lastName || ""}`.trim() || "Unknown"
                    const regNo = student.reg_no || student.regNo || ""
                    const className = student.class_name || student.className || student.class || ""
                    const feeStatus = student.fee_status || student.feeStatus || "unknown"
                    const initials = fullName.split(" ").map((n: string) => n[0]).join("")
                    
                    return (
                      <TableRow key={student.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                              {initials}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-card-foreground">{fullName}</p>
                              <p className="text-[11px] text-muted-foreground">{regNo}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{className}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`text-[11px] ${
                              feeStatus === "paid"
                                ? "bg-accent/10 text-accent"
                                : feeStatus === "partial"
                                ? "bg-warning/10 text-warning-foreground"
                                : "bg-destructive/10 text-destructive"
                            }`}
                          >
                            {feeStatus}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Recent Payments */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Recent Payments</CardTitle>
                <Link href="/dashboard/fees/payments">
                  <Button variant="ghost" size="sm" className="text-xs text-primary">
                    View All <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Student</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayments.slice(0, 5).map((payment) => {
                    const studentName = payment.student_name || payment.studentName || "Unknown"
                    return (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium text-card-foreground">{studentName}</p>
                            <p className="text-[11px] text-muted-foreground">{payment.date}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium text-card-foreground">
                          TSh {Number(payment.amount).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`text-[11px] ${
                              payment.status === "confirmed"
                                ? "bg-accent/10 text-accent"
                                : "bg-warning/10 text-warning-foreground"
                            }`}
                          >
                            {payment.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Notifications & Attendance */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Recent Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {notifications.slice(0, 5).map((notification) => (
                  <div
                    key={notification.id}
                    className="flex items-start gap-3 rounded-lg border border-border p-3"
                  >
                    <div
                      className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                        notification.type === "warning"
                          ? "bg-warning"
                          : notification.type === "success"
                          ? "bg-accent"
                          : "bg-primary"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-card-foreground">{notification.title}</p>
                        {!notification.read && (
                          <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 shrink-0">New</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{notification.message}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{notification.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Weekly Attendance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Weekly Attendance</CardTitle>
              <CardDescription>Student attendance this week</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.01 240)" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="oklch(0.50 0.02 250)" />
                    <YAxis tick={{ fontSize: 12 }} stroke="oklch(0.50 0.02 250)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "oklch(1 0 0)",
                        border: "1px solid oklch(0.90 0.01 240)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="present" stackId="a" fill={CHART_COLORS[1]} radius={[0, 0, 0, 0]} name="Present" />
                    <Bar dataKey="absent" stackId="a" fill="oklch(0.55 0.22 25)" radius={[4, 4, 0, 0]} name="Absent" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
