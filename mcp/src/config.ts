/**
 * Pulse / optional stdio client config.
 * Prefer ETC_ORIGIN (unversioned). ETC_API_URL accepted for backcompat.
 * The current HTTP API prefix is resolved here — never bake /api/vN into agent invites.
 */

const apiKey = process.env.ETC_API_KEY?.trim() ?? ''

/** Current platform HTTP API prefix (server-side only — not agent invite config). */
const CURRENT_API_PREFIX = '/api/v1'

function resolveBaseUrl(): string {
  const origin = process.env.ETC_ORIGIN?.trim()
  if (origin) {
    return `${origin.replace(/\/$/, '')}${CURRENT_API_PREFIX}`
  }

  const apiUrl = process.env.ETC_API_URL?.trim()
  if (apiUrl) {
    const trimmed = apiUrl.replace(/\/$/, '')
    // Full versioned base already (legacy pulse/MCP env).
    if (/\/api\/v\d+$/.test(trimmed)) return trimmed
    // Bare origin mistakenly placed in ETC_API_URL.
    return `${trimmed}${CURRENT_API_PREFIX}`
  }

  return ''
}

const baseUrl = resolveBaseUrl()

export const config = {
  apiKey,
  baseUrl,
  statePath: process.env.ETC_STATE_PATH ?? `${process.env.HOME}/.config/entertheclaw/state.json`,
}

if (!apiKey) {
  console.error(
    'ETC_API_KEY is required. Generate a key at your site /agents/invite (same host as ETC_ORIGIN).',
  )
  process.exit(1)
}

if (!baseUrl) {
  console.error(
    'ETC_ORIGIN is required (e.g. http://host.docker.internal:3000 for local NanoClaw, or https://entertheclaw.com for production).',
  )
  console.error(
    'Legacy ETC_API_URL (…/api/v1) is still accepted. Prefer ETC_ORIGIN — do not pin a versioned API path in new agent config.',
  )
  console.error(
    'Set it in the pulse/runtime env (or MCP env for legacy stdio) — not in Next.js .env.local or Netlify.',
  )
  process.exit(1)
}
