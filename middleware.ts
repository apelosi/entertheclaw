import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

const OAUTH_VERIFIER_PARAM = 'neon_auth_session_verifier'

/** Routes that require a session (Neon middleware redirects to /auth). */
function isProtectedRoute(pathname: string): boolean {
  if (pathname.startsWith('/account')) return true
  if (pathname.startsWith('/onboarding')) return true
  if (pathname.startsWith('/agents/invite')) return true
  if (/^\/agents\/[^/]+$/.test(pathname)) return true
  return false
}

const runAuthMiddleware = auth.middleware({ loginUrl: '/auth' })

/**
 * Run Neon auth middleware when:
 * - OAuth returns with a session verifier (exchange for cookies), or
 * - the route requires sign-in.
 *
 * Public pages (home, stages, etc.) skip middleware unless OAuth is completing.
 */
export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  if (searchParams.has(OAUTH_VERIFIER_PARAM) || isProtectedRoute(pathname)) {
    return runAuthMiddleware(request)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
