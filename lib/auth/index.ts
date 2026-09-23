import { createNeonAuth } from '@neondatabase/auth/next/server'
import { randomBytes } from 'crypto'

/**
 * `next build` instantiates this module while collecting page data. Deploy
 * previews (and some CI) may not inject runtime secrets — use an ephemeral
 * fallback so the compile can finish without introducing a predictable key.
 * Real requests still need
 * NEON_AUTH_COOKIE_SECRET (+ NEON_AUTH_BASE_URL) in the deploy environment.
 * Neon Auth requires cookies.secret length >= 32.
 */
const EPHEMERAL_FALLBACK_SECRET = randomBytes(32).toString('base64url')

function neonAuthCookieSecret(): string {
  const secret = process.env.NEON_AUTH_COOKIE_SECRET?.trim()
  if (secret && secret.length >= 32) return secret
  return EPHEMERAL_FALLBACK_SECRET
}

function neonAuthBaseUrl(): string {
  const base = process.env.NEON_AUTH_BASE_URL?.trim()
  if (base) return base
  return 'https://placeholder.invalid'
}

export const auth = createNeonAuth({
  baseUrl: neonAuthBaseUrl(),
  cookies: {
    secret: neonAuthCookieSecret(),
  },
})
