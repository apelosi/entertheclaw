import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { validateDisplayName } from '@/lib/auth/display-name'
import { callNeonAuthUpstream } from '@/lib/auth/neon-auth-upstream'
import { syncUserDisplayName } from '@/lib/users/public-profile'

export const runtime = 'nodejs'

/**
 * Set the user's display name.
 *
 * The public profile table (`user_profiles`) is the authoritative store and is
 * written first, so saving never depends on the upstream Neon Auth mutation.
 * That mutation can transiently fail on the very first request right after a
 * brand-new sign-up (the session isn't propagated upstream yet), which used to
 * make the form revert and force a second tap. Mirroring the name to the Neon
 * Auth profile is now best-effort: the app reads display names from
 * `user_profiles`, so an upstream hiccup must not block onboarding.
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

  // Authoritative write — this is what the app (and the onboarding gate) reads.
  await syncUserDisplayName(user.id, name)

  // Best-effort mirror to the Neon Auth profile name. Not fatal.
  const res = NextResponse.json({ ok: true })
  try {
    const upstream = await callNeonAuthUpstream(
      'update-user',
      { method: 'POST', body: { name } },
      request,
      { forwardSession: true },
    )
    if (upstream.ok) {
      // Forward any refreshed session cookies so the cached session reflects
      // the new name sooner.
      for (const cookie of upstream.headers.getSetCookie()) {
        res.headers.append('set-cookie', cookie)
      }
    } else {
      console.warn('[display-name] upstream update-user failed', upstream.status)
    }
  } catch (err) {
    console.warn('[display-name] upstream update-user error', err)
  }

  return res
}
