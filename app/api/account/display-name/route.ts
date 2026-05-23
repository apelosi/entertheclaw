import { auth } from '@/lib/auth'
import { validateDisplayName } from '@/lib/auth/display-name'
import { syncUserDisplayName } from '@/lib/users/public-profile'

export const runtime = 'nodejs'

/** Sync display name to public profile after Neon Auth update. */
export async function POST(request: Request) {
  const { data: session } = await auth.getSession()
  const user = session?.user
  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const displayName =
    typeof body === 'object' && body !== null && 'displayName' in body
      ? String((body as { displayName: unknown }).displayName)
      : ''

  const validationError = validateDisplayName(displayName)
  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 })
  }

  await syncUserDisplayName(user.id, displayName.trim())
  return Response.json({ ok: true })
}
