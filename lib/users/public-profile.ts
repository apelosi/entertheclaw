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
