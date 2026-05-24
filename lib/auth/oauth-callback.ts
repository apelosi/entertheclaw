import { NextResponse, type NextRequest } from 'next/server'

const OAUTH_VERIFIER_PARAM = 'neon_auth_session_verifier'
const NEON_AUTH_COOKIE_PREFIX = '__Secure-neon-auth'

// Cookies written by /api/auth/oauth-start, committed atomically with the
// Neon challenge cookie in the same 302 response.
const OAUTH_DEST_COOKIE = '__oauth_dest'
const OAUTH_NEW_USER_DEST_COOKIE = '__oauth_new_user_dest'
// Backup mirror of the PKCE challenge value. The original Neon cookie may be
// SameSite=Strict or stripped by iOS Safari ITP on cross-site redirect return.
// We copy the value to a SameSite=Lax cookie so we can re-inject it server-side.
const OAUTH_CHALLENGE_BACKUP_COOKIE = '__oauth_ch'
const NEON_CHALLENGE_COOKIE_NAME = '__Secure-neon-auth.session_challange'

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
 * Handle the OAuth callback at /auth/callback by delegating the verifier
 * exchange to Neon's own middleware — NOT by calling /get-session directly.
 *
 * Why NOT call /get-session directly:
 *   A direct server-side /get-session call returns session_token cookies but
 *   omits the session_data JWT that Neon's middleware caches on the client.
 *   Without session_data, every protected-route request triggers a fresh
 *   upstream round-trip to validate the session_token. That upstream call
 *   reliably fails in production, so users are bounced to /auth immediately
 *   after "signing in" — even though the OAuth exchange itself succeeded.
 *
 * Delegation strategy (combining af80f2b + 3c06d78 fixes):
 *   1. Read the verifier and the destination from __oauth_dest.
 *   2. Re-inject the PKCE challenge cookie from the __oauth_ch backup.
 *      The original __Secure-neon-auth.session_challange is SameSite=Strict
 *      and is dropped by browsers on the cross-site redirect return from the
 *      OAuth provider. The backup is SameSite=Lax so it survives that hop.
 *   3. Return a 200 HTML document (NOT a redirect) that:
 *      a. Sets __Secure-neon-auth.session_challange=<backup> via Set-Cookie.
 *      b. Expires all temporary flow cookies.
 *      c. Runs window.location.replace('<dest>?neon_auth_session_verifier=TOKEN').
 *   4. Because it is a document response (not a redirect), the browser commits
 *      the re-injected challenge cookie BEFORE the JS navigation fires.
 *      (iOS Safari does not reliably commit cookies on 302 redirect responses
 *      before following the Location header — hence the HTML page.)
 *   5. The subsequent same-site GET to <dest>?verifier=TOKEN carries the
 *      challenge cookie. Neon's middleware (runAuthMiddleware) exchanges the
 *      verifier, mints session_data + session_token, and the user is signed in.
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

  // Read the destination and challenge backup written by /api/auth/oauth-start.
  const destRaw = readCookie(cookieHeaderRaw, OAUTH_DEST_COOKIE)
  const newUserDestRaw = readCookie(cookieHeaderRaw, OAUTH_NEW_USER_DEST_COOKIE)
  const challengeBackup = readCookie(cookieHeaderRaw, OAUTH_CHALLENGE_BACKUP_COOKIE)

  console.log('[oauth-callback] enter', {
    hasVerifier: !!verifier,
    verifierPrefix: verifier?.slice(0, 8) ?? null,
    destRaw,
    newUserDestRaw: newUserDestRaw ?? null,
    hasChallengeBackup: !!challengeBackup,
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

  // Attach the verifier to the destination URL so Neon's middleware can exchange
  // it when the browser navigates there. Using URL API handles any existing query
  // params on safeCallback correctly.
  const destUrl = new URL(safeCallback, request.url)
  destUrl.searchParams.set(OAUTH_VERIFIER_PARAM, verifier)
  const destString = escapeJsSingleQuoted(destUrl.pathname + destUrl.search)

  console.log('[oauth-callback] delegating to Neon middleware', {
    dest: destUrl.pathname + destUrl.search,
    hasChallengeBackup: !!challengeBackup,
  })

  // Return a 200 HTML document. Using a document response (not 302) ensures the
  // browser commits Set-Cookie headers before the inline script fires — critical
  // for iOS Safari, which may not commit cookies on redirect responses in time.
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<script>window.location.replace('${destString}');</script>
</head><body></body></html>`

  const response = new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })

  // Re-inject the PKCE challenge as SameSite=Lax so that the subsequent
  // same-site GET to <dest>?verifier=TOKEN sends it to Neon's middleware.
  // The original Neon challenge cookie is SameSite=Strict and was dropped on
  // the cross-site redirect return from the OAuth provider; the backup survived.
  if (challengeBackup) {
    response.headers.append(
      'Set-Cookie',
      `${NEON_CHALLENGE_COOKIE_NAME}=${challengeBackup}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=60`,
    )
  }

  // Expire all temporary flow cookies set by /api/auth/oauth-start.
  response.headers.append('Set-Cookie', expireCookie(OAUTH_DEST_COOKIE))
  response.headers.append('Set-Cookie', expireCookie(OAUTH_NEW_USER_DEST_COOKIE))
  response.headers.append('Set-Cookie', expireCookie(OAUTH_CHALLENGE_BACKUP_COOKIE))

  return response
}

/** True if the request is the OAuth callback that should be handled in-line. */
export function isOAuthCallbackRequest(pathname: string, hasVerifier: boolean) {
  return pathname === '/auth/callback' && hasVerifier
}
