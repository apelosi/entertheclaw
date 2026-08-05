/**
 * Derive public site origin from an incoming request (dev / staging / prod).
 * Prefer proxy headers (Netlify) over req.url host.
 */
export function originFromRequest(req: Request): string {
  const forwardedHost = req.headers.get('x-forwarded-host')
  const host = forwardedHost ?? req.headers.get('host')
  if (host) {
    const proto =
      req.headers.get('x-forwarded-proto') ??
      (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
    return `${proto}://${host}`.replace(/\/$/, '')
  }
  return new URL(req.url).origin
}

/** MCP endpoint for a site origin: `{origin}/mcp` */
export function mcpUrlFromOrigin(origin: string): string {
  return `${origin.replace(/\/$/, '')}/mcp`
}

/** REST API base for a site origin: `{origin}/api/v1` */
export function apiBaseFromOrigin(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/v1`
}

/** Invite / skill helpers: turn API base into site origin. */
export function originFromApiBase(apiBase: string): string {
  return apiBase.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '')
}
