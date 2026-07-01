import { db } from '@/lib/db/client'
import { stages, stageParticipants, stageEvents, agents, characters } from '@/lib/db/schema'
import { isCommunityVisibleAgentWhere } from '@/lib/agents/community-visibility'
import { dialogueFromEventContent } from '@/lib/stage/feed-items'
import { resolveStageImageUrl } from '@/lib/db/stage-image-by-name'
import { eq, and, count, desc, inArray } from 'drizzle-orm'

/** Curated until we have a real "top stages" signal. Order is display order. */
export const FEATURED_STAGE_NAMES = [
  'Claw Wars',
  'Claws',
  'The Clawfather',
  'House of Claws',
  'Claw of the Titans',
  'The Clawshank Redemption',
] as const

async function attachStageMeta<T extends { id: string; name: string; imageUrl: string | null }>(
  stageRows: T[],
) {
  return Promise.all(
    stageRows.map(async (stage) => {
      const [participantCount] = await db
        .select({ count: count() })
        .from(stageParticipants)
        .where(eq(stageParticipants.stageId, stage.id))

      const recentEvents = await db
        .select()
        .from(stageEvents)
        .where(and(eq(stageEvents.stageId, stage.id), eq(stageEvents.type, 'dialogue')))
        .orderBy(desc(stageEvents.createdAt))
        .limit(1)

      const lastDialogue = dialogueFromEventContent(recentEvents[0]?.content)

      return {
        ...stage,
        imageUrl: resolveStageImageUrl(stage),
        participantCount: participantCount?.count ?? 0,
        lastLine: lastDialogue?.text,
        lastSpeakerName: lastDialogue?.speakerName,
      }
    })
  )
}

export async function getFeaturedStages() {
  const rows = await db
    .select()
    .from(stages)
    .where(and(eq(stages.isActive, true), inArray(stages.name, [...FEATURED_STAGE_NAMES])))

  const byName = new Map(rows.map((row) => [row.name, row]))
  const ordered = FEATURED_STAGE_NAMES.map((name) => byName.get(name)).filter(
    (stage): stage is (typeof rows)[number] => stage !== undefined
  )

  return attachStageMeta(ordered)
}

export async function getRecentAgents() {
  return db
    .select({
      id: agents.id,
      name: agents.name,
      agentType: agents.agentType,
      imageUrl: agents.imageUrl,
      status: agents.status,
    })
    .from(agents)
    .where(isCommunityVisibleAgentWhere())
    .orderBy(desc(agents.enrolledAt))
    .limit(6)
}

export async function getRecentCharacters() {
  return db
    .select({
      id: characters.id,
      name: characters.name,
      occupation: characters.occupation,
      imageUrl: characters.imageUrl,
      stageId: characters.stageId,
      status: agents.status,
    })
    .from(characters)
    .innerJoin(agents, eq(characters.agentId, agents.id))
    .where(eq(characters.isComplete, true))
    .orderBy(desc(characters.createdAt))
    .limit(6)
}

export async function getEnrolledAgentCount(): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(agents)
    .where(isCommunityVisibleAgentWhere())
  return Number(row?.count ?? 0)
}

export async function getCommunityCharacterCount(): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(characters)
    .where(eq(characters.isComplete, true))
  return Number(row?.count ?? 0)
}

export async function getCommunityFeed() {
  const [featuredStages, recentAgents, recentCharacters] = await Promise.all([
    getFeaturedStages().catch(() => []),
    getRecentAgents().catch(() => []),
    getRecentCharacters().catch(() => []),
  ])
  return { featuredStages, recentAgents, recentCharacters }
}
