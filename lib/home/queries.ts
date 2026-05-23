import { db } from '@/lib/db/client'
import { agents, characters, stages, stageParticipants } from '@/lib/db/schema'
import { and, eq, desc, isNotNull } from 'drizzle-orm'

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

export async function getMyCharacters(userId: string) {
  return db
    .select({
      id: characters.id,
      name: characters.name,
      occupation: characters.occupation,
      imageUrl: characters.imageUrl,
      stageId: characters.stageId,
      isComplete: characters.isComplete,
      agentId: characters.agentId,
      agentName: agents.name,
      stageName: stages.name,
    })
    .from(characters)
    .innerJoin(agents, eq(characters.agentId, agents.id))
    .leftJoin(stages, eq(characters.stageId, stages.id))
    .where(eq(agents.userId, userId))
    .orderBy(desc(characters.createdAt))
}
