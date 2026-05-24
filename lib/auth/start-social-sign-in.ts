/**
 * Start OAuth via a server-side 302 redirect.
 *
 * iOS Safari fix — two parts:
 *
 * 1. Outbound: navigate to `/api/auth/oauth-start` instead of fetch+assign.
 *    The server responds with a single `302 Location: <oauth-url>` carrying
 *    the challenge `Set-Cookie` (and a `__oauth_dest` destination cookie).
 *    The browser commits all cookies atomically before following the redirect.
 *    No JS race between cookie commit and cross-site navigation.
 *
 * 2. Inbound: the server always passes a clean `/auth/callback` (no query
 *    params) as the Neon callbackURL, so Neon's post-OAuth redirect lands at
 *    `/auth/callback?neon_auth_session_verifier=…` where our middleware
 *    (handleOAuthCallback in lib/auth/oauth-callback.ts) does the verifier
 *    exchange server-side and reads the real destination from the
 *    `__oauth_dest` cookie. This bypasses Neon's loginUrl short-circuit and
 *    avoids any dependency on query-param handling in Neon's redirect.
 */
export async function startSocialSignIn(options: {
  provider: 'github' | 'google' | 'apple'
  callbackURL: string
  newUserCallbackURL?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const url = new URL('/api/auth/oauth-start', window.location.origin)
    url.searchParams.set('provider', options.provider)
    url.searchParams.set('callbackURL', options.callbackURL)
    if (options.newUserCallbackURL) {
      url.searchParams.set('newUserCallbackURL', options.newUserCallbackURL)
    }
    window.location.assign(url.toString())
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not start OAuth sign-in',
    }
  }
}
