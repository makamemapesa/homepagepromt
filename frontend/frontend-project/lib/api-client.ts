import axios from "axios"
import { getAccessToken, setAccessToken, clearAccessToken } from "./auth"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// ─── Case converters ───────────────────────────────────────────────────────────
function toCamel(s: string) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}
function toSnake(s: string) {
  return s.replace(/([A-Z])/g, "_$1").toLowerCase()
}
function convertKeys(obj: unknown, fn: (s: string) => string): unknown {
  if (Array.isArray(obj)) return obj.map((v) => convertKeys(v, fn))
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [fn(k), convertKeys(v, fn)])
    )
  }
  return obj
}

// ─── Axios instance ────────────────────────────────────────────────────────────
// withCredentials=true ensures the httpOnly refresh cookie is sent on every
// request (needed for the /api/auth/token/refresh/ call).
export const api = axios.create({ baseURL: BASE_URL, withCredentials: true })

// Attach in-memory access token + convert request body to snake_case
api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  if (config.data && typeof config.data === "object" && !(config.data instanceof FormData)) {
    config.data = convertKeys(config.data, toSnake)
  }
  return config
})

// Convert response to camelCase + handle 401 with silent cookie-based refresh
api.interceptors.response.use(
  (response) => {
    if (response.data) {
      response.data = convertKeys(response.data, toCamel)
    }
    return response
  },
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        // The refresh token httpOnly cookie is sent automatically (withCredentials).
        // No need to pass a token in the body — the backend reads it from the cookie.
        const res = await axios.post(
          `${BASE_URL}/api/auth/token/refresh/`,
          {},
          { withCredentials: true }
        )
        const newAccess: string = res.data.access
        setAccessToken(newAccess)
        original.headers.Authorization = `Bearer ${newAccess}`
        return api(original)
      } catch {
        clearAccessToken()
        if (typeof window !== "undefined") window.location.href = "/login"
      }
    }
    return Promise.reject(error)
  }
)

// ─── Helpers ───────────────────────────────────────────────────────────────────
/** Extract results array from DRF paginated response or plain array */
export function getResults<T>(data: { results?: T[] } | T[]): T[] {
  if (Array.isArray(data)) return data
  return data.results ?? []
}
