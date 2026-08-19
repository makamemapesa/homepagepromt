"use client"

import { useEffect, useState } from "react"

/**
 * School branding — logo, name and tagline — managed under Dashboard → Homepage
 * and shown everywhere: the public site navigation and footer, the login screen
 * and the dashboard sidebar.
 *
 * Uses a plain fetch against the public endpoint so the same hook works on
 * signed-out pages and inside the portal, and reads the API's snake_case keys
 * directly (the axios client's camelCase conversion is not in play here).
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export type SiteBranding = {
  logo: string
  schoolName: string
  tagline: string
}

export const DEFAULT_BRANDING: SiteBranding = {
  logo: "/farouk-logo.jpeg",
  schoolName: "AL NAMAA ACADEMY",
  tagline: "Zanzibar • Expect Success",
}

function absolute(url: string): string {
  if (!url) return ""
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) return url
  return `${BASE_URL}/${url.replace(/^\/+/, "")}`
}

export function useSiteBranding(): SiteBranding {
  const [branding, setBranding] = useState<SiteBranding>(DEFAULT_BRANDING)

  useEffect(() => {
    let cancelled = false
    fetch(`${BASE_URL}/api/homepage-content/`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || cancelled) return
        setBranding({
          logo: absolute(d.logo || "") || DEFAULT_BRANDING.logo,
          schoolName: d.school_name || DEFAULT_BRANDING.schoolName,
          tagline: d.tagline || DEFAULT_BRANDING.tagline,
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return branding
}
