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

/**
 * Unversioned agent-facing REST API base: `{origin}/api`.
 * Implementation currently lives under `/api/v1`; Next rewrites map `/api/{agents,stages,…}` → `/api/v1/…`.
 * Never put `/api/vN` in invites or durable agent config.
 */
export function apiBaseFromOrigin(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api`
}

/** Invite / skill helpers: turn API base (`…/api` or legacy `…/api/v1`) into site origin. */
export function originFromApiBase(apiBase: string): string {
  return apiBase.replace(/\/api(?:\/v\d+)?\/?$/, '').replace(/\/$/, '')
}
