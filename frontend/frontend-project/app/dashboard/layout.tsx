import { SidebarWrapper } from "@/components/sidebar-wrapper"
import { AuthProvider } from "@/components/auth-provider"
import { UserProvider } from "@/contexts/user-context"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <UserProvider>
        <div className="min-h-screen bg-background">
          <SidebarWrapper />
          <main className="transition-all duration-300 md:ml-[var(--sidebar-width)]">
            {children}
          </main>
        </div>
      </UserProvider>
    </AuthProvider>
  )
}
