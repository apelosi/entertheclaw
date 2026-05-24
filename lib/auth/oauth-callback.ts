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
 * Handle the OAuth callback on /auth/callback by exchanging the verifier for a
 * session cookie ourselves, then redirecting to the final callbackURL.
 *
 * Why this exists: Neon's middleware short-circuits any pathname that starts
 * with `loginUrl` (we configure `'/auth'`) — including `/auth/callback` — and
 * returns `action: "allow"` BEFORE checking the verifier. That forces the
 * exchange onto the next request: the callback page bounces via client JS
 * `window.location.replace('/?verifier=…')`, and the middleware on `/` finally
 * does the exchange and returns `307 Set-Cookie + Location`. Desktop Chrome
 * handles that chain reliably; iOS Safari does not — across the JS-initiated
 * navigation and the 307+Set-Cookie hop the user ends up unauthenticated.
 *
 * Doing the exchange here, server-side, collapses the chain into a single
 * `302 Location: <final-callback>` response carrying the upstream session
 * `Set-Cookie`. The browser commits the cookie atomically with the redirect.
 *
 * We deliberately skip Neon's `session_data` JWT minting — it's a performance
 * cache, not required for correctness. Subsequent `getServerSession` calls
 * will fall through to the slow upstream path until the cache cookie gets
 * populated naturally on the next middleware-handled request.
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

  const neonCookiesPresentInRequest = extractNeonAuthCookies(cookieHeaderRaw)
  const hasChallenge = neonCookiesPresentInRequest.includes(NEON_CHALLENGE_COOKIE_NAME)
  const challengeBackup = readCookie(cookieHeaderRaw, OAUTH_CHALLENGE_BACKUP_COOKIE)

  console.log('[oauth-callback] cookie state', {
    hasChallenge,
    hasChallengeBackup: !!challengeBackup,
    hasDestCookie: !!destRaw,
    neonCookieNames,
  })

  // ── Strategy 1 (preferred): delegate to Neon's own middleware ─────────────
  //
  // Re-set the challenge cookie (SameSite=Lax) and redirect the browser to
  // <dest>?neon_auth_session_verifier=TOKEN. The browser commits the challenge
  // cookie before following the redirect, so Neon's middleware sees both the
  // verifier and the challenge, runs exchangeOAuthToken, and mints all session
  // cookies correctly (including the session_data JWT cache). This means
  // protected routes work immediately without any extra upstream round-trips.
  //
  // We use the backup value because the original challenge cookie from Neon was
  // SameSite=Strict and was dropped by iOS Safari on the cross-site return.
  if (challengeBackup) {
    const destUrl = new URL(safeCallback, request.url)
    destUrl.searchParams.set(OAUTH_VERIFIER_PARAM, verifier)

    const response = NextResponse.redirect(destUrl, 302)
    // Re-set the challenge with SameSite=Lax so it is sent on the top-level
    // GET navigation from /auth/callback to destUrl (same-site, but we use
    // Lax to be safe against any edge-case SameSite restrictions).
    response.headers.append(
      'Set-Cookie',
      `${NEON_CHALLENGE_COOKIE_NAME}=${challengeBackup}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=60`,
    )
    response.headers.append('Set-Cookie', expireCookie(OAUTH_DEST_COOKIE))
    response.headers.append('Set-Cookie', expireCookie(OAUTH_NEW_USER_DEST_COOKIE))
    response.headers.append('Set-Cookie', expireCookie(OAUTH_CHALLENGE_BACKUP_COOKIE))
    console.log('[oauth-callback] delegating to Neon middleware →', destUrl.pathname + destUrl.search)
    return response
  }

  // ── Strategy 2 (fallback): call /get-session directly ────────────────────
  //
  // Used when the backup challenge was not sent (shouldn't normally occur once
  // PR #16 is deployed, but kept as a fallback). We call Neon's /get-session
  // ourselves, forwarding whatever Neon auth cookies are available. If the
  // challenge cookie is also absent this will return 400.
  const upstreamUrl = new URL(`${baseUrl}/get-session`)
  upstreamUrl.searchParams.set(OAUTH_VERIFIER_PARAM, verifier)

  const cookieHeader = neonCookiesPresentInRequest
  const origin = request.headers.get('origin') ?? new URL(request.url).origin

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers: {
        Cookie: cookieHeader,
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

  const response = NextResponse.redirect(new URL(safeCallback, request.url), 302)
  for (const cookie of upstreamSetCookies) {
    response.headers.append('Set-Cookie', cookie)
  }
  response.headers.append('Set-Cookie', expireCookie(OAUTH_DEST_COOKIE))
  response.headers.append('Set-Cookie', expireCookie(OAUTH_NEW_USER_DEST_COOKIE))
  response.headers.append('Set-Cookie', expireCookie(OAUTH_CHALLENGE_BACKUP_COOKIE))
  console.log('[oauth-callback] fallback success — redirecting to', safeCallback)
  return response
}

/** True if the request is the OAuth callback that should be handled in-line. */
export function isOAuthCallbackRequest(pathname: string, hasVerifier: boolean) {
  return pathname === '/auth/callback' && hasVerifier
}
