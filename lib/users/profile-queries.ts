import { db } from '@/lib/db/client'
import { agents } from '@/lib/db/schema'
import { isCommunityVisibleAgentWhere } from '@/lib/agents/community-visibility'
import { and, desc, eq } from 'drizzle-orm'
import { getCharactersWithStatus } from '@/lib/characters/character-listing'

export async function getUserActiveAgents(userId: string) {
  return db
    .select({
      id: agents.id,
      name: agents.name,
      agentType: agents.agentType,
      imageUrl: agents.imageUrl,
      status: agents.status,
    })
    .from(agents)
    .where(and(eq(agents.userId, userId), isCommunityVisibleAgentWhere()))
    .orderBy(desc(agents.enrolledAt))
}

/** All of a user's characters, live or retired — excludes only explicitly
 *  incomplete ones (matches this page's pre-existing behavior). */
export async function getUserActiveCharacters(userId: string) {
  const rows = await getCharactersWithStatus({ userId })
  return rows.filter((r) => r.isComplete !== false)
}
