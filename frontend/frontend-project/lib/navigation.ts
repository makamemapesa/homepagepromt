import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  ClipboardList,
  CreditCard,
  Bell,
  Settings,
  BarChart3,
  UserCog,
  Shield,
  Heart,
  UserCircle,
  MessageCircle,
  FileCheck,
  Users2,
  Target,
  Globe,
} from "lucide-react"

export type UserRole = "super_admin" | "admin" | "teacher" | "accountant" | "parent" | "staff"

export interface NavItem {
  label: string
  href?: string
  icon: any
  roles: UserRole[]
  children?: Array<{
    label: string
    href: string
    roles: UserRole[]
  }>
}

/**
 * Complete navigation structure with role-based access control.
 * Each item specifies which roles can see it.
 */
export const allNavigation: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["super_admin", "admin", "teacher", "accountant", "parent"],
  },
  {
    label: "My Child's Portal",
    icon: UserCircle,
    roles: ["parent"],
    children: [
      { label: "Overview",    href: "/dashboard/parent",                       roles: ["parent"] },
      { label: "Timetable",   href: "/dashboard/parent?tab=timetable",         roles: ["parent"] },
      { label: "Attendance",  href: "/dashboard/parent?tab=attendance",        roles: ["parent"] },
      { label: "Results",     href: "/dashboard/parent?tab=results",           roles: ["parent"] },
      { label: "Payments",    href: "/dashboard/parent?tab=payments",          roles: ["parent"] },
      { label: "My Application", href: "/dashboard/parent?tab=application",   roles: ["parent"] },
    ],
  },
  {
    label: "User Management",
    href: "/dashboard/users",
    icon: UserCog,
    roles: ["super_admin"], // Only super admins
  },
  {
    label: "Admissions",
    icon: FileCheck,
    roles: ["super_admin", "admin"],
    children: [
      {
        label: "Applications",
        href: "/dashboard/admissions",
        roles: ["super_admin", "admin"],
      },
      {
        label: "Apply Online (Link)",
        href: "/apply",
        roles: ["super_admin", "admin"],
      },
    ],
  },
  {
    label: "Students",
    icon: GraduationCap,
    roles: ["super_admin", "admin", "teacher", "accountant", "parent"],
    children: [
      {
        label: "All Students",
        href: "/dashboard/students",
        roles: ["super_admin", "admin", "teacher", "accountant"],
      },
      {
        label: "My Children",
        href: "/dashboard/parent",
        roles: ["parent"],
      },
      {
        label: "New Registration",
        href: "/dashboard/students/register",
        roles: ["super_admin", "admin"],
      },
      {
        label: "Import Students",
        href: "/dashboard/students/import",
        roles: ["super_admin"],
      },
      {
        label: "Promotions",
        href: "/dashboard/students/promotions",
        roles: ["super_admin", "admin"],
      },
    ],
  },
  {
    label: "Donors & Sponsors",
    href: "/dashboard/donors",
    icon: Heart,
    roles: ["super_admin", "admin"], // Only admins
  },
  {
    label: "Team & Content",
    href: "/dashboard/team",
    icon: Users2,
    roles: ["super_admin", "admin"],
  },
  {
    label: "Homepage",
    href: "/dashboard/homepage",
    icon: Globe,
    roles: ["super_admin", "admin"],
  },
  {
    label: "Fundraisers",
    href: "/dashboard/fundraisers",
    icon: Target,
    roles: ["super_admin", "admin"],
  },
  {
    label: "Academics",
    icon: BookOpen,
    roles: ["super_admin", "admin", "teacher"],
    children: [
      {
        label: "Classes",
        href: "/dashboard/academics/classes",
        roles: ["super_admin", "admin", "teacher"],
      },
      {
        label: "Subjects",
        href: "/dashboard/academics/subjects",
        roles: ["super_admin", "admin", "teacher"],
      },
      {
        label: "Teacher Assignment",
        href: "/dashboard/academics/assignments",
        roles: ["super_admin", "admin"],
      },
      {
        label: "Teachers",
        href: "/dashboard/academics/teachers",
        roles: ["super_admin", "admin"],
      },
      {
        label: "Timetable",
        href: "/dashboard/academics/timetable",
        roles: ["super_admin", "admin", "teacher"],
      },
      {
        label: "Attendance",
        href: "/dashboard/academics/attendance",
        roles: ["super_admin", "admin", "teacher"],
      },
      {
        label: "Academic Calendar",
        href: "/dashboard/academics/calendar",
        roles: ["super_admin", "admin", "teacher"],
      },
      {
        label: "Lesson Plans",
        href: "/dashboard/academics/lesson-plans",
        roles: ["super_admin", "admin", "teacher"],
      },
    ],
  },
  {
    label: "Examinations",
    icon: ClipboardList,
    roles: ["super_admin", "admin", "teacher", "accountant", "parent"],
    children: [
      {
        label: "Marks Entry",
        href: "/dashboard/exams/marks",
        roles: ["super_admin", "admin", "teacher"],
      },
      {
        label: "Results",
        href: "/dashboard/exams/results",
        roles: ["super_admin", "admin", "teacher", "accountant", "parent"],
      },
      {
        label: "Report Cards",
        href: "/dashboard/exams/reports",
        roles: ["super_admin", "admin", "teacher", "accountant", "parent"],
      },
      {
        label: "Merit List",
        href: "/dashboard/exams/merit",
        roles: ["super_admin", "admin", "teacher"],
      },
    ],
  },
  {
    label: "Fees & Payments",
    icon: CreditCard,
    roles: ["super_admin", "admin", "accountant", "parent"],
    children: [
      {
        label: "Fee Structure",
        href: "/dashboard/fees/structure",
        roles: ["super_admin", "admin", "accountant"],
      },
      {
        label: "Payments",
        href: "/dashboard/fees/payments",
        roles: ["super_admin", "admin", "accountant", "parent"],
      },
      {
        label: "Outstanding",
        href: "/dashboard/fees/outstanding",
        roles: ["super_admin", "admin", "accountant"],
      },
    ],
  },
  {
    label: "Reports & Analytics",
    href: "/dashboard/reports",
    icon: BarChart3,
    roles: ["super_admin", "admin", "teacher", "accountant"],
  },
  {
    label: "Messages",
    href: "/dashboard/messages",
    icon: MessageCircle,
    roles: ["super_admin", "admin", "teacher", "parent"],
  },
  {
    label: "Notifications",
    href: "/dashboard/notifications",
    icon: Bell,
    roles: ["super_admin", "admin", "teacher", "accountant", "parent"],
  },
  {
    label: "Audit Logs",
    href: "/dashboard/audit",
    icon: Shield,
    roles: ["super_admin"], // Only super admins
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    roles: ["super_admin", "admin"],
  },
]

/**
 * Filter navigation items based on user role.
 */
export function getNavigationForRole(role: UserRole | null | undefined): NavItem[] {
  if (!role) return []

  return allNavigation
    .filter((item) => item.roles.includes(role))
    .map((item) => {
      if (item.children) {
        return {
          ...item,
          children: item.children.filter((child) => child.roles.includes(role)),
        }
      }
      return item
    })
    .filter((item) => !item.children || item.children.length > 0) // Remove parent if all children filtered out
}
