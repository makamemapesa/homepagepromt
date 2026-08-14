// Access token lives only in memory (never persisted to localStorage/sessionStorage).
// The refresh token is stored in an httpOnly cookie by the backend — it cannot be
// read or stolen by JavaScript, which eliminates the XSS token-theft vector.

let _accessToken: string | null = null

export function getAccessToken(): string | null {
  return _accessToken
}

export function setAccessToken(token: string): void {
  _accessToken = token
}

export function clearAccessToken(): void {
  _accessToken = null
}

// Legacy aliases kept so existing callers don't break.
export function getTokens() {
  return _accessToken ? { access: _accessToken, refresh: null } : null
}
export function setTokens(access: string, _refresh?: string | null): void {
  _accessToken = access
}
export function clearTokens(): void {
  _accessToken = null
}

/** Decode a JWT payload without verifying the signature (client-side only). */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split(".")[1]
    if (!base64) return null
    const padded = base64.replace(/-/g, "+").replace(/_/g, "/")
    const json = atob(padded)
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * Returns true only if an access token is held in memory AND its `exp` claim
 * has not yet passed.  When the page is hard-refreshed the token is gone from
 * memory; `AuthProvider` will attempt a silent cookie-based refresh before
 * redirecting to /login.
 */
export function isAuthenticated(): boolean {
  if (!_accessToken) return false

  const payload = decodeJwtPayload(_accessToken)
  if (!payload) return false

  const exp = payload.exp as number | undefined
  if (exp !== undefined) {
    const nowSeconds = Math.floor(Date.now() / 1000)
    if (nowSeconds >= exp) {
      _accessToken = null
      return false
    }
  }

  return true
}
