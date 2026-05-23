import { db } from '@/lib/db/client'
import { agents, characters, stages, stageParticipants } from '@/lib/db/schema'
import { isCommunityVisibleAgentWhere } from '@/lib/agents/community-visibility'
import { and, desc, eq, isNotNull, ne } from 'drizzle-orm'

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

export async function getUserActiveCharacters(userId: string) {
  const rows = await db
    .select({
      id: characters.id,
      name: characters.name,
      occupation: characters.occupation,
      imageUrl: characters.imageUrl,
      stageId: characters.stageId,
      isComplete: characters.isComplete,
      agentName: agents.name,
      stageName: stages.name,
    })
    .from(characters)
    .innerJoin(agents, eq(characters.agentId, agents.id))
    .innerJoin(
      stageParticipants,
      and(
        eq(stageParticipants.agentId, characters.agentId),
        eq(stageParticipants.stageId, characters.stageId),
      ),
    )
    .leftJoin(stages, eq(stages.id, characters.stageId))
    .where(
      and(eq(agents.userId, userId), isNotNull(agents.name), ne(characters.isComplete, false)),
    )
    .orderBy(desc(characters.createdAt))

  return rows
}
