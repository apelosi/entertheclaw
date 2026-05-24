import { callNeonAuthUpstream } from '@/lib/auth/neon-auth-upstream'

export const runtime = 'nodejs'

/**
 * Server-side OAuth initiation.
 *
 * Why this exists: the prior flow did `fetch('/api/auth/sign-in/social', {disableRedirect:true})`
 * from the client, parsed the resulting OAuth URL from JSON, then did
 * `window.location.assign(url)`. The challenge cookie set on the fetch response
 * had to commit before the navigation to GitHub. iOS Safari is unreliable about
 * persisting cookies set on a fetch when JS immediately initiates a top-level
 * navigation to a third-party origin — the commit and the navigation race, and
 * Safari sometimes drops the cookie. By the time the user returned to our
 * domain, `needsSessionVerification` (which requires the challenge cookie) was
 * false, so the verifier exchange never ran and the user landed back on /auth.
 *
 * This endpoint folds the two steps into a single HTTP response: the browser
 * gets `302 Location: <oauth-url>` with the challenge `Set-Cookie` attached,
 * and atomically commits both before following the redirect. No JS race.
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

  const upstream = await callNeonAuthUpstream(
    'sign-in/social',
    {
      method: 'POST',
      body: {
        provider,
        callbackURL,
        disableRedirect: true,
        ...(newUserCallbackURL ? { newUserCallbackURL } : {}),
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

  const setCookies = upstream.headers.getSetCookie()
  const headers = new Headers({ Location: data.url })
  for (const cookie of setCookies) {
    headers.append('Set-Cookie', cookie)
  }
  console.log('[oauth-start] success', {
    provider,
    setCookieCount: setCookies.length,
    setCookieNames: setCookies.map((c) => c.split('=')[0]),
    uaBrief: (request.headers.get('user-agent') ?? '').slice(0, 120),
  })
  return new Response(null, { status: 302, headers })
}
