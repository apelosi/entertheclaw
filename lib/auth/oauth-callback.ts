import { NextResponse, type NextRequest } from 'next/server'

const OAUTH_VERIFIER_PARAM = 'neon_auth_session_verifier'
const NEON_AUTH_COOKIE_PREFIX = '__Secure-neon-auth'

// Cookies written by /api/auth/oauth-start, committed atomically with the
// Neon challenge cookie in the same 302 response.
const OAUTH_DEST_COOKIE = '__oauth_dest'
const OAUTH_NEW_USER_DEST_COOKIE = '__oauth_new_user_dest'
// Backup mirror of the PKCE challenge value. The original Neon cookie may be
// SameSite=Strict or stripped by iOS Safari ITP on cross-site redirect return.
// We copy the value to a SameSite=Lax cookie so we can inject it server-side.
const OAUTH_CHALLENGE_BACKUP_COOKIE = '__oauth_ch'
const NEON_CHALLENGE_COOKIE_NAME = '__Secure-neon-auth.session_challange'

/** Filter a `Cookie:` header value to only Neon Auth cookies. */
function extractNeonAuthCookies(cookieHeader: string): string {
  if (!cookieHeader) return ''
  return cookieHeader
    .split(';')
    .map((c) => c.trim())
    .filter((c) => c.startsWith(NEON_AUTH_COOKIE_PREFIX))
    .join('; ')
}

/** Read a single cookie value from a raw `Cookie:` header string. */
function readCookie(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k.trim() === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

/** Expire a cookie by setting Max-Age=0. */
function expireCookie(name: string): string {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}

/**
 * Escape a string for safe interpolation into a single-quoted JS string literal.
 * Only backslash and single-quote need escaping inside '...'.
 */
function escapeJsSingleQuoted(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/**
 * Handle the OAuth callback on /auth/callback by exchanging the verifier for a
 * session cookie ourselves, then navigating the browser to the final destination
 * via an HTML page — NOT a 302+Set-Cookie redirect.
 *
 * iOS Safari problem (why an HTML page instead of a redirect):
 *   Any approach that sets session cookies on a 302/307 redirect response and
 *   then immediately redirects to a protected route fails on iOS Safari because
 *   the browser may not commit the cookies before making the follow-up request.
 *   This manifests as "signed in successfully" but every protected route still
 *   bounces to /auth.
 *
 *   By returning a 200 HTML document with the Set-Cookie headers, the browser
 *   commits all cookies as part of processing the document response. Only then
 *   does the inline <script> run window.location.replace(dest). The protected
 *   route request therefore always carries the freshly-minted session cookie.
 *
 * Exchange flow:
 *   1. Read the verifier from the URL and the destination from __oauth_dest.
 *   2. Call Neon's /get-session?verifier=TOKEN, injecting the backup challenge
 *      cookie (__oauth_ch → __Secure-neon-auth.session_challange) when the
 *      original challenge was dropped by iOS Safari on the cross-site return.
 *   3. Forward Neon's Set-Cookie headers (session token + extras) on a 200
 *      HTML response that auto-navigates to the real destination via JS.
 *   4. Expire all our temporary cookies (__oauth_dest, __oauth_ch, etc.).
 */
export async function handleOAuthCallback(
  request: NextRequest,
): Promise<NextResponse> {
  const { searchParams } = request.nextUrl
  const verifier = searchParams.get(OAUTH_VERIFIER_PARAM)
  const ua = request.headers.get('user-agent') ?? ''
  const cookieHeaderRaw = request.headers.get('cookie') ?? ''

  const neonCookieNames = cookieHeaderRaw
    .split(';')
    .map((c) => c.trim().split('=')[0])
    .filter((n) => n.startsWith(NEON_AUTH_COOKIE_PREFIX))

  // Read the destination cookies written by /api/auth/oauth-start.
  const destRaw = readCookie(cookieHeaderRaw, OAUTH_DEST_COOKIE)
  const newUserDestRaw = readCookie(cookieHeaderRaw, OAUTH_NEW_USER_DEST_COOKIE)

  console.log('[oauth-callback] enter', {
    hasVerifier: !!verifier,
    verifierPrefix: verifier?.slice(0, 8) ?? null,
    destRaw,
    newUserDestRaw: newUserDestRaw ?? null,
    neonCookieNames,
    referer: request.headers.get('referer'),
    uaBrief: ua.slice(0, 120),
  })

  // Validate destination: must be a same-origin path (no open-redirect).
  const safeCallback = (() => {
    const raw = destRaw
    if (!raw) return '/'
    if (raw.startsWith('/') && !raw.startsWith('//')) return raw
    return '/'
  })()

  if (!verifier) {
    console.warn('[oauth-callback] missing verifier; redirecting to /auth')
    return NextResponse.redirect(
      new URL('/auth?error=missing_verifier', request.url),
      302,
    )
  }

  const baseUrl = process.env.NEON_AUTH_BASE_URL?.replace(/\/$/, '')
  if (!baseUrl) {
    console.error('[oauth-callback] NEON_AUTH_BASE_URL not configured')
    return NextResponse.redirect(
      new URL('/auth?error=server_misconfigured', request.url),
      302,
    )
  }

  // Build the Cookie header for the upstream /get-session call.
  // Start with whatever Neon auth cookies the browser sent (may include the
  // original challenge if not dropped), then inject the backup challenge when
  // the original was stripped by iOS Safari ITP / SameSite=Strict enforcement.
  const neonCookiesFromRequest = extractNeonAuthCookies(cookieHeaderRaw)
  const challengeBackup = readCookie(cookieHeaderRaw, OAUTH_CHALLENGE_BACKUP_COOKIE)
  const hasOriginalChallenge = neonCookiesFromRequest.includes(NEON_CHALLENGE_COOKIE_NAME)

  let cookiesForUpstream = neonCookiesFromRequest
  if (challengeBackup && !hasOriginalChallenge) {
    // Inject backup challenge as the real challenge cookie name so Neon can
    // verify the PKCE flow. readCookie already URL-decodes the stored value;
    // Cookie request headers use the raw value, so do NOT re-encode here.
    const injected = `${NEON_CHALLENGE_COOKIE_NAME}=${challengeBackup}`
    cookiesForUpstream = cookiesForUpstream ? `${cookiesForUpstream}; ${injected}` : injected
  }

  console.log('[oauth-callback] cookie state', {
    hasOriginalChallenge,
    hasChallengeBackup: !!challengeBackup,
    hasDestCookie: !!destRaw,
    neonCookieNames,
    willInjectBackup: !!challengeBackup && !hasOriginalChallenge,
  })

  const upstreamUrl = new URL(`${baseUrl}/get-session`)
  upstreamUrl.searchParams.set(OAUTH_VERIFIER_PARAM, verifier)
  const origin = request.headers.get('origin') ?? new URL(request.url).origin

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers: {
        Cookie: cookiesForUpstream,
        Origin: origin,
        'x-neon-auth-middleware': 'true',
      },
    })
  } catch (err) {
    console.error('[oauth-callback] upstream fetch failed', err)
    return NextResponse.redirect(
      new URL('/auth?error=oauth_upstream_unreachable', request.url),
      302,
    )
  }

  const upstreamSetCookies = upstream.headers.getSetCookie()
  console.log('[oauth-callback] upstream response', {
    status: upstream.status,
    ok: upstream.ok,
    setCookieCount: upstreamSetCookies.length,
    setCookieNames: upstreamSetCookies.map((c) => c.split('=')[0]),
  })

  if (!upstream.ok) {
    const body = await upstream.text().catch(() => '')
    console.error('[oauth-callback] upstream non-ok body', body.slice(0, 500))
    return NextResponse.redirect(
      new URL(`/auth?error=oauth_exchange_failed_${upstream.status}`, request.url),
      302,
    )
  }

  // ── Return a 200 HTML page, NOT a redirect ─────────────────────────────────
  //
  // iOS Safari does not reliably commit cookies set on a 302/307 redirect
  // response before following the Location header. Returning a real document
  // (status 200) guarantees cookies are committed before the inline script
  // executes window.location.replace, so the protected-route request always
  // carries the session token.
  const dest = escapeJsSingleQuoted(safeCallback)
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<script>window.location.replace('${dest}');</script>
</head><body></body></html>`

  console.log('[oauth-callback] exchange success — serving HTML nav to', safeCallback)

  const response = new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })

  // Commit session cookies on the real document response.
  for (const cookie of upstreamSetCookies) {
    response.headers.append('Set-Cookie', cookie)
  }

  // Expire our temporary flow cookies.
  response.headers.append('Set-Cookie', expireCookie(OAUTH_DEST_COOKIE))
  response.headers.append('Set-Cookie', expireCookie(OAUTH_NEW_USER_DEST_COOKIE))
  response.headers.append('Set-Cookie', expireCookie(OAUTH_CHALLENGE_BACKUP_COOKIE))

  return response
}

/** True if the request is the OAuth callback that should be handled in-line. */
export function isOAuthCallbackRequest(pathname: string, hasVerifier: boolean) {
  return pathname === '/auth/callback' && hasVerifier
}
