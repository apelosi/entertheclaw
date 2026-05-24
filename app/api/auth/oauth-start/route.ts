import { callNeonAuthUpstream } from '@/lib/auth/neon-auth-upstream'

export const runtime = 'nodejs'

// The clean path we always give Neon as callbackURL — no query params, so
// Neon can safely append ?neon_auth_session_verifier=… without risk of URL
// construction issues. The real post-OAuth destination is stored in a cookie.
const NEON_CALLBACK_PATH = '/auth/callback'

// Cookie we use to carry the real destination across the OAuth redirect chain.
// Set alongside the Neon challenge cookie in the same 302 response so both
// are committed atomically before the cross-site navigation to the provider.
const OAUTH_DEST_COOKIE = '__oauth_dest'
const OAUTH_NEW_USER_DEST_COOKIE = '__oauth_new_user_dest'
// Backup copy of the Neon challenge cookie value. Neon sets the challenge as
// __Secure-neon-auth.session_challange which may have SameSite=Strict or be
// otherwise dropped by iOS Safari on cross-site redirect return. We mirror the
// value in our own SameSite=Lax cookie so handleOAuthCallback can inject it
// back when calling /get-session, even if the original was not forwarded.
const OAUTH_CHALLENGE_BACKUP_COOKIE = '__oauth_ch'
const NEON_CHALLENGE_COOKIE_NAME = '__Secure-neon-auth.session_challange'
const COOKIE_MAX_AGE = 600 // 10 minutes — more than enough for an OAuth flow

/**
 * Extract the value of a named cookie from a list of Set-Cookie header strings.
 * Returns null if the cookie is not found.
 */
function extractSetCookieValue(setCookieHeaders: string[], name: string): string | null {
  for (const header of setCookieHeaders) {
    const [nameValue] = header.split(';')
    const eqIdx = nameValue.indexOf('=')
    if (eqIdx < 0) continue
    if (nameValue.slice(0, eqIdx).trim() === name) {
      return nameValue.slice(eqIdx + 1).trim()
    }
  }
  return null
}

/**
 * Server-side OAuth initiation.
 *
 * Why this exists: the prior flow did `fetch('/api/auth/sign-in/social', {disableRedirect:true})`
 * from the client, parsed the resulting OAuth URL from JSON, then did
 * `window.location.assign(url)`. The challenge cookie set on the fetch response
 * had to commit before the navigation to GitHub. iOS Safari is unreliable about
 * persisting cookies set on a fetch when JS immediately initiates a top-level
 * navigation to a third-party origin — the commit and the navigation race, and
 * Safari sometimes drops the cookie.
 *
 * This endpoint fixes two things in one response:
 *
 * 1. Atomic cookie commit: the browser gets `302 Location: <oauth-url>` with
 *    the Neon challenge `Set-Cookie` (and a `__oauth_dest` destination cookie).
 *    All cookies commit before the redirect is followed. No JS race.
 *
 * 2. Clean callbackURL: we always pass `/auth/callback` (no query params) as
 *    the Neon callbackURL. Neon appends `?neon_auth_session_verifier=…` to
 *    this clean path, and our middleware intercepts it to do the exchange
 *    server-side. Storing the destination in a cookie avoids any dependency on
 *    Neon correctly appending a verifier to a URL that already has query params.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const provider = url.searchParams.get('provider')
  const callbackURL = url.searchParams.get('callbackURL')
  const newUserCallbackURL = url.searchParams.get('newUserCallbackURL')

  if (!provider || !callbackURL) {
    return Response.redirect(
      new URL('/auth?error=missing_oauth_params', request.url),
      302,
    )
  }

  // Always give Neon a clean callback path with no query params.
  const upstream = await callNeonAuthUpstream(
    'sign-in/social',
    {
      method: 'POST',
      body: {
        provider,
        callbackURL: NEON_CALLBACK_PATH,
        disableRedirect: true,
        ...(newUserCallbackURL ? { newUserCallbackURL: NEON_CALLBACK_PATH } : {}),
      },
    },
    request,
  )

  if (!upstream.ok) {
    const errorBody = (await upstream.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null
    const message =
      errorBody?.error ??
      errorBody?.message ??
      `oauth_start_failed_${upstream.status}`
    console.error('[oauth-start] upstream rejected', {
      status: upstream.status,
      message,
    })
    return Response.redirect(
      new URL(`/auth?error=${encodeURIComponent(message)}`, request.url),
      302,
    )
  }

  const data = (await upstream.json().catch(() => null)) as
    | { url?: string }
    | null
  if (typeof data?.url !== 'string' || !data.url) {
    console.error('[oauth-start] upstream returned no url', data)
    return Response.redirect(
      new URL('/auth?error=oauth_start_no_url', request.url),
      302,
    )
  }

  // Build the cookie attributes string shared by both destination cookies.
  const cookieAttrs = `Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`

  const setCookies = upstream.headers.getSetCookie()
  const headers = new Headers({ Location: data.url })

  // Forward Neon's challenge cookie(s) as-is.
  for (const cookie of setCookies) {
    headers.append('Set-Cookie', cookie)
  }

  // Mirror the challenge value in our own SameSite=Lax cookie so that
  // handleOAuthCallback can inject it into the /get-session call even when
  // the original __Secure-neon-auth.session_challange is dropped by iOS Safari
  // (which happens when the cookie is SameSite=Strict or ITP strips it on the
  // cross-site redirect return from the OAuth provider).
  const challengeValue = extractSetCookieValue(setCookies, NEON_CHALLENGE_COOKIE_NAME)
  if (challengeValue) {
    headers.append(
      'Set-Cookie',
      `${OAUTH_CHALLENGE_BACKUP_COOKIE}=${encodeURIComponent(challengeValue)}; ${cookieAttrs}`,
    )
  }

  // Store the real destinations so handleOAuthCallback can redirect there.
  headers.append('Set-Cookie', `${OAUTH_DEST_COOKIE}=${encodeURIComponent(callbackURL)}; ${cookieAttrs}`)
  if (newUserCallbackURL) {
    headers.append('Set-Cookie', `${OAUTH_NEW_USER_DEST_COOKIE}=${encodeURIComponent(newUserCallbackURL)}; ${cookieAttrs}`)
  }

  console.log('[oauth-start] success', {
    provider,
    callbackURL,
    newUserCallbackURL: newUserCallbackURL ?? null,
    setCookieCount: setCookies.length,
    setCookieNames: setCookies.map((c) => c.split('=')[0]),
    hasChallengeBackup: !!challengeValue,
    uaBrief: (request.headers.get('user-agent') ?? '').slice(0, 120),
  })
  return new Response(null, { status: 302, headers })
}
