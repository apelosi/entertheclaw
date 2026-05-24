import { NextResponse, type NextRequest } from 'next/server'

const OAUTH_VERIFIER_PARAM = 'neon_auth_session_verifier'
const NEON_AUTH_COOKIE_PREFIX = '__Secure-neon-auth'

// Destination cookies written by /api/auth/oauth-start alongside the Neon
// challenge cookie — both committed atomically in the same 302 response.
const OAUTH_DEST_COOKIE = '__oauth_dest'
const OAUTH_NEW_USER_DEST_COOKIE = '__oauth_new_user_dest'

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

  const upstreamUrl = new URL(`${baseUrl}/get-session`)
  upstreamUrl.searchParams.set(OAUTH_VERIFIER_PARAM, verifier)

  // Forward only Neon Auth cookies (challenge cookie etc.) — matches what
  // Neon's own proxy does. Sending the full cookie jar would leak unrelated
  // cookies and risk header-size limits.
  const cookieHeader = extractNeonAuthCookies(cookieHeaderRaw)
  const origin = request.headers.get('origin') ?? new URL(request.url).origin

  if (!cookieHeader) {
    console.warn('[oauth-callback] no Neon Auth cookies on request — likely Safari cookie drop', {
      anyCookies: !!cookieHeaderRaw,
      rawCookieNames: cookieHeaderRaw
        .split(';')
        .map((c) => c.trim().split('=')[0])
        .filter(Boolean),
    })
  }

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
      new URL(
        `/auth?error=oauth_exchange_failed_${upstream.status}`,
        request.url,
      ),
      302,
    )
  }

  // Determine the final destination.
  // newUserDestRaw is only set when the caller supplied a newUserCallbackURL.
  // We don't have a reliable way to detect new-vs-existing from /get-session
  // response headers alone, so we check if the session response body carries
  // an `isNewUser` hint. If not, fall back to the standard dest.
  let finalDest = safeCallback
  if (newUserDestRaw) {
    try {
      const body = await upstream.json() as Record<string, unknown>
      const isNew = body?.isNewUser === true
      if (isNew && newUserDestRaw.startsWith('/') && !newUserDestRaw.startsWith('//')) {
        finalDest = newUserDestRaw
      }
    } catch {
      // Not a JSON body or no isNewUser flag — stay with safeCallback.
    }
  }

  const response = NextResponse.redirect(new URL(finalDest, request.url), 302)
  for (const cookie of upstreamSetCookies) {
    response.headers.append('Set-Cookie', cookie)
  }
  // Expire the destination cookies — they've served their purpose.
  response.headers.append('Set-Cookie', expireCookie(OAUTH_DEST_COOKIE))
  response.headers.append('Set-Cookie', expireCookie(OAUTH_NEW_USER_DEST_COOKIE))

  console.log('[oauth-callback] success — redirecting to', finalDest)
  return response
}

/** True if the request is the OAuth callback that should be handled in-line. */
export function isOAuthCallbackRequest(pathname: string, hasVerifier: boolean) {
  return pathname === '/auth/callback' && hasVerifier
}
