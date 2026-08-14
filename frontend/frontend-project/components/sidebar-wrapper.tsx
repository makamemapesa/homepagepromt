"use client"

import dynamic from "next/dynamic"

export const SidebarWrapper = dynamic(
  () => import("@/components/dashboard-sidebar").then((m) => m.DashboardSidebar),
  { ssr: false }
)
