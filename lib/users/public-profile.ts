import { db } from '@/lib/db/client'
import { userProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function syncUserDisplayName(userId: string, displayName: string) {
  const name = displayName.trim()
  if (!name) return

  await db
    .insert(userProfiles)
    .values({ userId, displayName: name })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: { displayName: name, updatedAt: new Date() },
    })
}

export async function getPublicDisplayName(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ displayName: userProfiles.displayName })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1)

  return row?.displayName ?? null
}

/**
 * True when the user has not yet chosen a public display name.
 *
 * This is the authoritative onboarding gate: it depends only on our own
 * `user_profiles` table (written when the user submits the display-name form),
 * not on the Neon Auth `name` field — which can be auto-populated (empty,
 * full email, or an OAuth provider name) and is therefore unreliable for
 * deciding whether to run the sign-up onboarding step.
 */
export async function userNeedsDisplayName(userId: string): Promise<boolean> {
  return (await getPublicDisplayName(userId)) === null
}
