import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { validateDisplayName } from '@/lib/auth/display-name'
import { callNeonAuthUpstream } from '@/lib/auth/neon-auth-upstream'
import { syncUserDisplayName } from '@/lib/users/public-profile'

export const runtime = 'nodejs'

/**
 * Set the user's display name: update the Neon Auth profile name AND sync it to
 * the public profile table. The Neon Auth update runs server-side via the
 * trusted upstream path because the browser-proxied /api/auth/update-user call
 * is blocked by Better Auth's CSRF origin check in production.
 */
export async function POST(request: Request) {
  const { data: session } = await auth.getSession()
  const user = session?.user
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const displayName =
    typeof body === 'object' && body !== null && 'displayName' in body
      ? String((body as { displayName: unknown }).displayName)
      : ''

  const validationError = validateDisplayName(displayName)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const name = displayName.trim()

  // Authoritative update: this is what needsDisplayName() reads on later logins.
  const upstream = await callNeonAuthUpstream(
    'update-user',
    { method: 'POST', body: { name } },
    request,
    { forwardSession: true },
  )
  if (!upstream.ok) {
    const data = (await upstream.json().catch(() => null)) as { message?: string } | null
    return NextResponse.json(
      { error: data?.message ?? 'Could not save display name.' },
      { status: upstream.status },
    )
  }

  await syncUserDisplayName(user.id, name)

  const res = NextResponse.json({ ok: true })
  // Forward any refreshed session cookies so the cached session reflects the
  // new name immediately (otherwise onboarding could re-trigger briefly).
  for (const cookie of upstream.headers.getSetCookie()) {
    res.headers.append('set-cookie', cookie)
  }
  return res
}
