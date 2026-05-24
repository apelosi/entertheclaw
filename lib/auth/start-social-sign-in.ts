/**
 * Start OAuth via a server-side 302 redirect.
 *
 * Two-part iOS Safari fix:
 *
 * 1. Outbound: navigate to `/api/auth/oauth-start` instead of fetch+assign.
 *    The server responds `302 Location: <oauth-url> + Set-Cookie: challenge`.
 *    The browser commits the challenge cookie atomically before following
 *    the redirect — no JS race where `window.location.assign` fires before
 *    the fetch response cookie is persisted.
 *
 * 2. Inbound: wrap the real destination as `/auth/callback?neon_popup_callback=<dest>`.
 *    Neon's post-OAuth redirect lands at `/auth/callback?neon_auth_session_verifier=…`
 *    where our middleware (handleOAuthCallback in lib/auth/oauth-callback.ts) does
 *    the verifier exchange server-side and returns `302 <dest> + Set-Cookie: session`.
 *    This bypasses the Neon middleware's loginUrl short-circuit and avoids relying
 *    on the challenge cookie surviving the cross-site redirect chain (which iOS
 *    Safari does not guarantee).
 */
export async function startSocialSignIn(options: {
  provider: 'github' | 'google' | 'apple'
  callbackURL: string
  newUserCallbackURL?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const url = new URL('/api/auth/oauth-start', window.location.origin)
    url.searchParams.set('provider', options.provider)
    // Route Neon's post-OAuth redirect through /auth/callback so our middleware
    // can exchange the verifier server-side without depending on the challenge
    // cookie (which iOS Safari drops across cross-site redirects). The real
    // destination is encoded as neon_popup_callback and recovered by
    // handleOAuthCallback in lib/auth/oauth-callback.ts.
    const wrap = (dest: string) =>
      `/auth/callback?neon_popup_callback=${encodeURIComponent(dest)}`
    url.searchParams.set('callbackURL', wrap(options.callbackURL))
    if (options.newUserCallbackURL) {
      url.searchParams.set('newUserCallbackURL', wrap(options.newUserCallbackURL))
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
