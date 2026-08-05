/**
 * Derive public site origin from an incoming request (dev / staging / prod).
 * Prefer proxy headers (Netlify) over req.url host.
 */
const DEFAULT_SITE_ORIGIN = 'https://entertheclaw.com'

function defaultSiteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  return DEFAULT_SITE_ORIGIN
}

function normalizeForwardedHost(host: string | null): string | null {
  if (!host) return null
  const first = host.split(',')[0]?.trim()
  return first || null
}

function parseOrigin(proto: string, host: string): URL | null {
  if (proto !== 'http' && proto !== 'https') return null
  try {
    return new URL(`${proto}://${host}`)
  } catch {
    return null
  }
}

function configuredHostnames(): Set<string> {
  const hosts = new Set<string>([
    'localhost',
    '127.0.0.1',
    '::1',
    'entertheclaw.com',
  ])
  const extra = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.URL, // Netlify runtime URL
    process.env.DEPLOY_PRIME_URL, // Netlify preview URL
  ]
  for (const value of extra) {
    const trimmed = value?.trim()
    if (!trimmed) continue
    try {
      hosts.add(new URL(trimmed).hostname.toLowerCase())
    } catch {
      // Ignore malformed env values; default host set still applies.
    }
  }
  return hosts
}

const ALLOWED_HOSTNAMES = configuredHostnames()

function isAllowedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (ALLOWED_HOSTNAMES.has(host)) return true
  return host.endsWith('.entertheclaw.com') || host.endsWith('.netlify.app')
}

export function originFromRequest(req: Request): string {
  const fallback = defaultSiteOrigin()

  const direct = (() => {
    try {
      const url = new URL(req.url)
      return isAllowedHostname(url.hostname) ? url.origin : null
    } catch {
      return null
    }
  })()

  const forwardedHost = normalizeForwardedHost(req.headers.get('x-forwarded-host'))
  if (forwardedHost) {
    const proto =
      req.headers.get('x-forwarded-proto') ??
      (forwardedHost.startsWith('localhost') || forwardedHost.startsWith('127.0.0.1')
        ? 'http'
        : 'https')
    const forwarded = parseOrigin(proto, forwardedHost)
    if (forwarded && isAllowedHostname(forwarded.hostname)) {
      return forwarded.origin
    }
  }

  return direct ?? fallback
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
