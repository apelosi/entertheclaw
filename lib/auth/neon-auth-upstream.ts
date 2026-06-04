/**
 * Direct Neon Auth API calls without forwarding browser session cookies.
 * Used for logged-in account flows where Better Auth CSRF origin checks block
 * the proxied /api/auth/* path even when app domains are allowlisted.
 */
export function resolveAppOrigin(request?: Request): string {
  const fromRequest = request?.headers.get('origin')
  if (fromRequest) return fromRequest

  const referer = request?.headers.get('referer')
  if (referer) {
    try {
      return new URL(referer).origin
    } catch {
      // ignore malformed referer
    }
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')

  return 'https://entertheclaw.com'
}

export async function callNeonAuthUpstream(
  path: string,
  init: { method: 'POST'; body: Record<string, unknown> },
  request?: Request,
  options?: { forwardSession?: boolean },
): Promise<Response> {
  const baseUrl = process.env.NEON_AUTH_BASE_URL?.replace(/\/$/, '')
  if (!baseUrl) {
    return Response.json(
      { error: 'NEON_AUTH_BASE_URL is not configured.' },
      { status: 500 },
    )
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-neon-auth-middleware': 'true',
    Origin: resolveAppOrigin(request),
  }

  // Authenticated endpoints (e.g. update-user) identify the user from the
  // Neon Auth session cookie, so forward the browser's cookies upstream.
  if (options?.forwardSession) {
    const cookie = request?.headers.get('cookie')
    if (cookie) headers.Cookie = cookie
  }

  return fetch(`${baseUrl}/${path}`, {
    method: init.method,
    headers,
    body: JSON.stringify(init.body),
  })
}
