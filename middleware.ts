import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { handleOAuthCallback, isOAuthCallbackRequest } from '@/lib/auth/oauth-callback'

const OAUTH_VERIFIER_PARAM = 'neon_auth_session_verifier'

/** Routes that require a session (Neon middleware redirects to /auth). */
function isProtectedRoute(pathname: string): boolean {
  if (pathname.startsWith('/account')) return true
  if (pathname.startsWith('/onboarding')) return true
  if (pathname.startsWith('/agents/invite')) return true
  return false
}

const runAuthMiddleware = auth.middleware({ loginUrl: '/auth' })

/**
 * Run Neon auth middleware when:
 * - OAuth returns with a session verifier (exchange for cookies), or
 * - the route requires sign-in.
 *
 * /auth/callback gets a dedicated path: Neon's own middleware short-circuits
 * any pathname under loginUrl ('/auth') without running the verifier exchange,
 * which forces the exchange onto a second request via a JS-initiated redirect.
 * That chain is unreliable on iOS Safari. We do the exchange in-line here
 * instead so the response is a single 302 + Set-Cookie + final Location.
 *
 * Public pages (home, stages, etc.) skip middleware unless OAuth is completing.
 */
export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  const hasVerifier = searchParams.has(OAUTH_VERIFIER_PARAM)

  if (isOAuthCallbackRequest(pathname, hasVerifier)) {
    return handleOAuthCallback(request)
  }

  if (hasVerifier || isProtectedRoute(pathname)) {
    return runAuthMiddleware(request)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
