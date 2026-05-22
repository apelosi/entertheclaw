/**
 * Direct Neon Auth API calls without forwarding browser session cookies.
 * Used for logged-in account flows where Better Auth CSRF origin checks block
 * the proxied /api/auth/* path even when app domains are allowlisted.
 */
export async function callNeonAuthUpstream(
  path: string,
  init: { method: 'POST'; body: Record<string, unknown> },
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
    },
    body: JSON.stringify(init.body),
  })
}
