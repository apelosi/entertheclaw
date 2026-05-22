import { cache } from 'react'
import { headers } from 'next/headers'

const SESSION_TOKEN_COOKIE = '__Secure-neon-auth.session_token'

type SessionResult = {
  data: {
    session: { id: string; expiresAt: string; token: string } | null
    user: {
      id: string
      email?: string | null
      name?: string | null
      image?: string | null
      emailVerified?: boolean
    } | null
  } | null
  error: { message: string; status?: number; statusText?: string } | null
}

/**
 * Read session in Server Components without calling auth.getSession() directly
 * (which may refresh cookies and throw in RSC on Next.js 15).
 * Proxies to /api/auth/get-session where cookie writes are allowed.
 */
export const getServerSession = cache(async (): Promise<SessionResult> => {
  const hdrs = await headers()
  const cookie = hdrs.get('cookie')
  if (!cookie?.includes(SESSION_TOKEN_COOKIE)) {
    return { data: null, error: null }
  }

  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? 'localhost:3000'
  const proto = hdrs.get('x-forwarded-proto') ?? 'http'
  const res = await fetch(`${proto}://${host}/api/auth/get-session`, {
    headers: { cookie },
    cache: 'no-store',
  })

  const body = (await res.json().catch(() => null)) as SessionResult['data'] | null
  if (!res.ok) {
    return {
      data: null,
      error: {
        message: typeof body === 'object' && body && 'message' in body
          ? String((body as { message: string }).message)
          : res.statusText,
        status: res.status,
        statusText: res.statusText,
      },
    }
  }

  return { data: body, error: null }
})
