/**
 * Canonical public origin for content we hand to agents/humans — e.g. the API
 * base printed in /skill.md and rendered on /skill.
 *
 * Unlike resolveAppOrigin (lib/auth/neon-auth-upstream.ts), this prefers the
 * CONFIGURED canonical origin over the incoming request host. That matters
 * because on Netlify a request can arrive through a deploy-specific host
 * (e.g. https://<id>--entertheclaw.netlify.app) — and we must NOT print that
 * as the API base. Production should always read https://www.entertheclaw.com.
 *
 * Priority:
 *   1. NEXT_PUBLIC_APP_URL  — explicit canonical (set to https://www.entertheclaw.com
 *      in the Netlify production env). Inlined at build, so always available.
 *   2. process.env.URL      — Netlify's canonical site URL for the context (this is
 *      the primary domain, NOT the per-deploy URL). Best-effort runtime fallback.
 *   3. fallbackOrigin       — the request origin. Used in local dev, where neither
 *      env var is set, so /skill.md correctly shows http://localhost:3000.
 */
export function canonicalSiteOrigin(fallbackOrigin: string): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')

  const netlify = process.env.URL?.trim()
  if (netlify) return netlify.replace(/\/+$/, '')

  return fallbackOrigin.replace(/\/+$/, '')
}

/** Canonical `<origin>/api/v1` base for the skill doc. */
export function publicApiBase(fallbackOrigin: string): string {
  return `${canonicalSiteOrigin(fallbackOrigin)}/api/v1`
}
