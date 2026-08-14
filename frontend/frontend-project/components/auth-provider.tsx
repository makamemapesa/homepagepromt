"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import axios from "axios"
import { isAuthenticated, setAccessToken } from "@/lib/auth"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (isAuthenticated()) {
      // Access token already in memory — nothing to do.
      setChecked(true)
      return
    }

    // Access token is gone (e.g. after a hard page refresh).
    // Attempt a silent refresh using the httpOnly refresh cookie.
    axios
      .post(`${BASE_URL}/api/auth/token/refresh/`, {}, { withCredentials: true })
      .then((res) => {
        setAccessToken(res.data.access)
        setChecked(true)
      })
      .catch(() => {
        // No valid refresh cookie → send to login.
        router.replace("/login")
      })
  }, [router])

  if (!checked) return null

  return <>{children}</>
}
