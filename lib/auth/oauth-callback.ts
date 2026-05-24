import { NextResponse, type NextRequest } from 'next/server'

const OAUTH_VERIFIER_PARAM = 'neon_auth_session_verifier'
const POPUP_CALLBACK_PARAM = 'neon_popup_callback'
const NEON_AUTH_COOKIE_PREFIX = '__Secure-neon-auth'

/** Filter a `Cookie:` header value to only Neon Auth cookies. */
function extractNeonAuthCookies(cookieHeader: string): string {
  if (!cookieHeader) return ''
  return cookieHeader
    .split(';')
    .map((c) => c.trim())
    .filter((c) => c.startsWith(NEON_AUTH_COOKIE_PREFIX))
    .join('; ')
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
  const popupCallback = searchParams.get(POPUP_CALLBACK_PARAM)

  const safeCallback = (() => {
    if (!popupCallback) return '/'
    // Only allow same-origin paths starting with '/'. Avoid open-redirect.
    if (popupCallback.startsWith('/') && !popupCallback.startsWith('//')) {
      return popupCallback
    }
    return '/'
  })()

  const callbackUrl = new URL(safeCallback, request.url)

  if (!verifier) {
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
  const cookieHeader = extractNeonAuthCookies(request.headers.get('cookie') ?? '')
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

  if (!upstream.ok) {
    console.error('[oauth-callback] upstream returned', upstream.status)
    return NextResponse.redirect(
      new URL(
        `/auth?error=oauth_exchange_failed_${upstream.status}`,
        request.url,
      ),
      302,
    )
  }

  const response = NextResponse.redirect(callbackUrl, 302)
  for (const cookie of upstream.headers.getSetCookie()) {
    response.headers.append('Set-Cookie', cookie)
  }
  return response
}

/** True if the request is the OAuth callback that should be handled in-line. */
export function isOAuthCallbackRequest(pathname: string, hasVerifier: boolean) {
  return pathname === '/auth/callback' && hasVerifier
}
