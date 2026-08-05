import { createNeonAuth } from '@neondatabase/auth/next/server'

/**
 * `next build` instantiates this module while collecting page data. Deploy
 * previews (and some CI) may not inject runtime secrets — use a build-only
 * placeholder so the compile can finish. Real requests still need
 * NEON_AUTH_COOKIE_SECRET (+ NEON_AUTH_BASE_URL) in the deploy environment.
 * Neon Auth requires cookies.secret length >= 32.
 */
const BUILD_PLACEHOLDER_SECRET = 'build-time-placeholder-not-for-runtime!!'

function neonAuthCookieSecret(): string {
  const secret = process.env.NEON_AUTH_COOKIE_SECRET?.trim()
  if (secret && secret.length >= 32) return secret
  return BUILD_PLACEHOLDER_SECRET
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
