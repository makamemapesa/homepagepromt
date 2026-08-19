"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ArrowLeft, Bell, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { api, getResults } from "@/lib/api-client"

export function DashboardHeader({
  title,
  description,
  backHref,
}: {
  title: string
  description?: string
  /** Where Back goes. Defaults to browser history, falling back to the dashboard. */
  backHref?: string
}) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [recentNotifications, setRecentNotifications] = useState<any[]>([])
  const router = useRouter()
  const pathname = usePathname()
  // The dashboard home is the root of the section — there is nowhere "back" to.
  const showBack = pathname !== "/dashboard"

  const goBack = () => {
    if (backHref) {
      router.push(backHref)
      return
    }
    // history.back() only helps if there is history from within the app.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
    } else {
      router.push("/dashboard")
    }
  }

  useEffect(() => {
    api.get("/api/notifications/?read=false&page_size=4")
      .then(r => {
        const items = getResults(r.data)
        setUnreadCount(items.length)
        setRecentNotifications(items)
      })
      .catch(() => {})
  }, [])

  return (
    <header className="flex flex-col gap-4 border-b border-border bg-card px-6 py-4 md:flex-row md:items-center md:justify-between">
      <div className="ml-8 flex items-center gap-3 md:ml-0">
        {showBack && (
          <Button
            variant="outline"
            size="sm"
            onClick={goBack}
            className="h-8 shrink-0 gap-1.5 px-2.5"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
        )}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-card-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search students, classes..."
            className="w-64 pl-9 bg-secondary border-0"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-0.5 -right-0.5 h-4 w-4 p-0 text-[10px] flex items-center justify-center bg-accent text-accent-foreground">
                  {unreadCount}
                </Badge>
              )}
              <span className="sr-only">Notifications</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="font-semibold">
              Notifications
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {recentNotifications.length === 0 ? (
              <DropdownMenuItem disabled className="text-sm text-muted-foreground justify-center py-3">
                No unread notifications
              </DropdownMenuItem>
            ) : recentNotifications.map((notification) => (
              <DropdownMenuItem key={notification.id} className="flex flex-col items-start gap-1 py-3">
                <div className="flex items-center gap-2 w-full">
                  <span className="text-sm font-medium">{notification.title}</span>
                  {!notification.read && (
                    <span className="h-2 w-2 rounded-full bg-accent ml-auto shrink-0" />
                  )}
                </div>
                <span className="text-xs text-muted-foreground line-clamp-1">
                  {notification.message}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-center text-sm text-primary font-medium justify-center">
              View all notifications
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
