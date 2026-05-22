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
): Promise<Response> {
  const baseUrl = process.env.NEON_AUTH_BASE_URL?.replace(/\/$/, '')
  if (!baseUrl) {
    return Response.json(
      { error: 'NEON_AUTH_BASE_URL is not configured.' },
      { status: 500 },
    )
  }

  return fetch(`${baseUrl}/${path}`, {
    method: init.method,
    headers: {
      'Content-Type': 'application/json',
      'x-neon-auth-middleware': 'true',
      Origin: resolveAppOrigin(request),
    },
    body: JSON.stringify(init.body),
  })
}
