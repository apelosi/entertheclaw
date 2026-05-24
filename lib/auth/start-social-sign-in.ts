/**
 * Start OAuth via a server-side 302 redirect.
 *
 * The browser navigates to our `/api/auth/oauth-start` route, which calls Neon
 * upstream and responds with a single `302 Location: <oauth-url>` carrying the
 * challenge `Set-Cookie`. The browser atomically commits the cookie and
 * follows the redirect to the OAuth provider — no JS race between cookie
 * commit and navigation. This is what makes the flow reliable on iOS Safari,
 * where the previous fetch+`window.location.assign` pattern sometimes dropped
 * the challenge cookie before the navigation to GitHub, leaving the verifier
 * exchange unable to find the matching challenge cookie on the return trip.
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
