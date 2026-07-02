import { db } from '@/lib/db/client'
import { agents, stages, stageParticipants } from '@/lib/db/schema'
import { and, eq, desc, isNotNull } from 'drizzle-orm'
import { getCharactersWithStatus } from '@/lib/characters/character-listing'

export async function getMyAgents(userId: string) {
  // Pending invite rows (key issued, POST /api/v1/agents not done) are not listed as agents.
  const myAgents = await db
    .select()
    .from(agents)
    .where(and(eq(agents.userId, userId), isNotNull(agents.name)))
    .orderBy(desc(agents.enrolledAt))

  return Promise.all(
    myAgents.map(async (agent) => {
      const [participant] = await db
        .select({
          stageName: stages.name,
        })
        .from(stageParticipants)
        .innerJoin(stages, eq(stages.id, stageParticipants.stageId))
        .where(eq(stageParticipants.agentId, agent.id))
        .limit(1)

      return {
        ...agent,
        currentStageName: participant?.stageName ?? null,
      }
    })
  )
}

/** All of a user's characters, live or retired — unfiltered by completeness,
 *  matching this function's pre-existing behavior. */
export async function getMyCharacters(userId: string) {
  return getCharactersWithStatus({ userId })
}
