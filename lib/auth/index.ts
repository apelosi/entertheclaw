import { createNeonAuth } from '@neondatabase/auth/next/server'

/**
 * `next build` instantiates this module while collecting page data. Deploy
 * previews (and some CI) may not inject runtime secrets — use a build-only
 * placeholder so the compile can finish. Real requests still need
 * NEON_AUTH_COOKIE_SECRET set in the deploy environment.
 */
function neonAuthCookieSecret(): string {
  const secret = process.env.NEON_AUTH_COOKIE_SECRET
  if (secret) return secret
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return 'build-time-placeholder-not-for-runtime'
  }
  // Keep a non-empty fallback so import doesn't crash; session crypto will be wrong
  // until the env var is set (dev/preview misconfig is obvious at sign-in).
  return 'missing-NEON_AUTH_COOKIE_SECRET'
}

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: neonAuthCookieSecret(),
  },
})
