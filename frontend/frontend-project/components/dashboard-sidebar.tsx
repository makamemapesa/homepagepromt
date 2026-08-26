"use client"

import Link from "next/link"
import { useSiteBranding } from "@/hooks/use-site-branding"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import {
  ChevronDown,
  Menu,
  X,
  LogOut,
  Settings as SettingsIcon,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { api, getResults } from "@/lib/api-client"
import { useUser } from "@/contexts/user-context"
import { getNavigationForRole, NavItem as NavigationItem } from "@/lib/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

/**
 * Is `href` the page currently on screen?
 *
 * Three things the old `pathname === href` check got wrong:
 *  - a detail route such as /dashboard/students/edit/5 left "Students" unlit,
 *    so a nested page looked like it belonged to no section at all;
 *  - /dashboard would match every route under it if compared by prefix, so it
 *    stays an exact match;
 *  - the parent portal links carry a ?tab=, which usePathname() never returns,
 *    so none of them could ever match. Comparing the tab as well keeps exactly
 *    one of those six lit at a time.
 */
function isHrefActive(pathname: string, search: string, href: string) {
  const [path, query] = href.split("?")

  const samePath =
    path === "/dashboard"
      ? pathname === path
      : pathname === path || pathname.startsWith(path + "/")
  if (!samePath) return false

  const currentTab = new URLSearchParams(search).get("tab") ?? ""
  const linkTab = new URLSearchParams(query ?? "").get("tab") ?? ""
  return currentTab === linkTab
}

interface NavItemProps {
  item: NavigationItem
  collapsed: boolean
  unreadCount?: number
  onNavigate: () => void
  onExpandSidebar: () => void
}

function NavItem({ item, collapsed, unreadCount = 0, onNavigate, onExpandSidebar }: NavItemProps) {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const Icon = item.icon

  const hasActiveChild = !!item.children?.some((child) =>
    isHrefActive(pathname, search, child.href)
  )
  const isActive = item.href ? isHrefActive(pathname, search, item.href) : hasActiveChild

  // Open the group you are actually inside. Starting every group closed meant
  // landing on Marks Entry from a bookmark showed a sidebar with nothing
  // highlighted and no hint of where you were.
  const [isOpen, setIsOpen] = useState(hasActiveChild)
  useEffect(() => {
    if (hasActiveChild) setIsOpen(true)
  }, [hasActiveChild])

  if (item.children) {
    return (
      <Collapsible
        open={isOpen && !collapsed}
        onOpenChange={(next) => {
          // A collapsed rail has nowhere to show the children, so the click
          // that used to do nothing now widens the sidebar and opens the group.
          if (collapsed) {
            onExpandSidebar()
            setIsOpen(true)
            return
          }
          setIsOpen(next)
        }}
      >
        <CollapsibleTrigger asChild>
          <button
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">{item.label}</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    isOpen && "rotate-180"
                  )}
                />
              </>
            )}
          </button>
        </CollapsibleTrigger>
        {!collapsed && (
          <CollapsibleContent className="pl-8 pt-1">
            <div className="flex flex-col gap-0.5 border-l-2 border-sidebar-border pl-3">
              {item.children.map((child) => (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onNavigate}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm transition-colors",
                    isHrefActive(pathname, search, child.href)
                      ? "text-sidebar-primary font-medium"
                      : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                  )}
                >
                  {child.label}
                </Link>
              ))}
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    )
  }

  return (
    <Link
      href={item.href!}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-primary"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="flex-1">{item.label}</span>}
      {!collapsed && item.href === "/dashboard/notifications" && unreadCount > 0 && (
        <Badge className="bg-accent text-accent-foreground h-5 px-1.5 text-xs">
          {unreadCount}
        </Badge>
      )}
    </Link>
  )
}

const COLLAPSED_KEY = "dashboard-sidebar-collapsed"
const COLLAPSED_WIDTH = "68px"
const EXPANDED_WIDTH = "16rem"

export function DashboardSidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const { user, loading, logout } = useUser()
  const branding = useSiteBranding()
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams().toString()

  // Remember the rail across reloads — re-expanding it on every refresh is the
  // sort of thing that makes the button feel broken.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "true")
    } catch {
      /* private browsing or blocked storage — the default is fine */
    }
  }, [])

  // The main column reads this variable, so the two can never disagree.
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-width", collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH
    )
    try {
      window.localStorage.setItem(COLLAPSED_KEY, String(collapsed))
    } catch {
      /* nothing to do — the sidebar still works, it just will not be remembered */
    }
  }, [collapsed])

  // Close the mobile drawer once navigation actually happens. Without this the
  // overlay stayed over the page you had just asked for. Watching the URL also
  // covers the parent-portal links, which only change the query string.
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname, search])

  // Collapsing is a desktop idea. The mobile drawer is always full width, so a
  // rail left collapsed on a wide screen must not strip the labels out of it
  // when the same session is later resized down to a phone.
  const railCollapsed = collapsed && !mobileOpen

  // The drawer is a modal on small screens; let Escape dismiss it.
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [mobileOpen])

  // Get navigation items based on user role
  const navigation = getNavigationForRole(user?.role)

  useEffect(() => {
    api.get("/api/notifications/?read=false").then(r => {
      const items = getResults(r.data)
      setUnreadCount(items.length)
    }).catch(() => {})
  }, [])

  // Get user initials
  const getUserInitials = () => {
    if (!user) return "?"
    return `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "U"
  }

  // Get role display name
  const getRoleDisplayName = () => {
    if (!user) return "Loading..."
    const roleMap: Record<string, string> = {
      super_admin: "Super Admin",
      admin: "Administrator",
      teacher: "Teacher",
      accountant: "Accountant",
      parent: "Parent",
      staff: "Staff",
    }
    return roleMap[user.role] || user.role
  }

  const handleLogout = () => {
    logout()
  }

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 md:hidden text-foreground"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        <span className="sr-only">Toggle navigation</span>
      </Button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 flex h-screen flex-col bg-sidebar text-sidebar-foreground transition-all duration-300",
          collapsed ? "w-64 md:w-[68px]" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-4">
          <img src={branding.logo} alt={branding.schoolName}
            className="h-9 w-9 shrink-0 rounded-lg object-cover" />
          {!railCollapsed ? (
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight">{branding.schoolName}</span>
              <span className="text-[10px] text-sidebar-foreground/60 leading-none">
                School Management
              </span>
            </div>
          ) : (
            <span className="sr-only">{branding.schoolName}</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto hidden h-7 w-7 text-sidebar-foreground/60 hover:text-sidebar-foreground md:flex"
            onClick={() => setCollapsed(!collapsed)}
            title={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="h-4 w-4" />
            <span className="sr-only">{railCollapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
          </Button>
        </div>

        <Separator className="bg-sidebar-border" />

        {/* Navigation */}
        <ScrollArea className="flex-1 min-h-0 px-3 py-3">
          <nav className="flex flex-col gap-1">
            {navigation.map((item) => (
              <NavItem
                key={item.label}
                item={item}
                collapsed={railCollapsed}
                unreadCount={unreadCount}
                onNavigate={() => setMobileOpen(false)}
                onExpandSidebar={() => setCollapsed(false)}
              />
            ))}
          </nav>
        </ScrollArea>

        <Separator className="bg-sidebar-border" />

        {/* User section */}
        <div className="p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-sidebar-accent">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                {!railCollapsed && (
                  <div className="flex-1 text-left">
                    <p className="text-xs font-medium leading-tight">
                      {user ? `${user.firstName} ${user.lastName}` : "Loading..."}
                    </p>
                    <p className="text-[10px] text-sidebar-foreground/60">
                      {getRoleDisplayName()}
                    </p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
                <User className="mr-2 h-4 w-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
                <SettingsIcon className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  )
}
