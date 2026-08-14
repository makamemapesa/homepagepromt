"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { api } from "@/lib/api-client"
import { isAuthenticated, clearTokens } from "@/lib/auth"
import { useRouter } from "next/navigation"

export type UserRole = "super_admin" | "admin" | "teacher" | "accountant" | "parent" | "staff"

export interface UserProfile {
  id: number
  username: string
  firstName: string
  lastName: string
  email: string
  role: UserRole
  isActive: boolean
  lastLogin: string | null
}

interface UserContextType {
  user: UserProfile | null
  loading: boolean
  error: string | null
  refreshUser: () => Promise<void>
  logout: () => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const fetchUser = async () => {
    if (!isAuthenticated()) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const response = await api.get("/api/users/me/")
      setUser(response.data)
    } catch (err: any) {
      console.error("Failed to fetch user profile:", err)
      setError(err.response?.data?.detail || "Failed to load user profile")
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      // The backend reads the refresh token from the httpOnly cookie and blacklists it.
      // withCredentials is set on the api instance so the cookie is sent automatically.
      await api.post("/api/auth/token/blacklist/", {})
    } catch {
      // Blacklist call failing should never block logout
    } finally {
      clearTokens()
      setUser(null)
      router.push("/login")
    }
  }

  useEffect(() => {
    fetchUser()
  }, [])

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        error,
        refreshUser: fetchUser,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}
