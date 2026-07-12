import { db } from '@/lib/db/client'
import {
  agents,
  archivedCharacters,
  characters,
  userProfiles,
} from '@/lib/db/schema'
import { and, eq, inArray } from 'drizzle-orm'

/**
 * characterName -> portrait url for dialogue avatars, including DEPARTED
 * characters. Their live `characters` row is deleted on leave, but the snapshot
 * (name + portrait url, which the image route still serves from archived bytes)
 * survives in `archived_characters` — so old speakers keep their photo in the
 * feed instead of falling back to a placeholder.
 */
export async function getStageSpeakerImages(
  stageId: string,
): Promise<Record<string, string | null>> {
  const [current, archived] = await Promise.all([
    db
      .select({ name: characters.name, imageUrl: characters.imageUrl })
      .from(characters)
      .where(eq(characters.stageId, stageId)),
    db
      .select({ characterData: archivedCharacters.characterData })
      .from(archivedCharacters)
      .where(eq(archivedCharacters.stageId, stageId)),
  ])

  const images: Record<string, string | null> = {}
  for (const c of current) {
    if (c.name) images[c.name] = c.imageUrl
  }
  for (const a of archived) {
    const data = a.characterData as { name?: unknown; imageUrl?: unknown } | null
    const name = typeof data?.name === 'string' ? data.name : null
    if (name && !(name in images)) {
      images[name] = typeof data?.imageUrl === 'string' ? data.imageUrl : null
    }
  }
  return images
}

interface CastEnrichable {
  id: string
  type: string
  agentId?: string | null
  characterName?: string | null
  agentName?: string | null
  ownerName?: string | null
}

/**
 * Attaches character name (primary), agent name, and owner name to the
 * joined/left events in a page, resolving only the agentIds actually present so
 * this stays cheap on paginated /feed calls. Non-cast events pass through
 * untouched. Character name resolves from the live row or the archived snapshot.
 */
export async function enrichCastEvents<T extends CastEnrichable>(
  events: T[],
  stageId: string,
): Promise<T[]> {
  const castAgentIds = [
    ...new Set(
      events
        .filter((e) => e.type === 'joined' || e.type === 'left')
        .map((e) => e.agentId)
        .filter((id): id is string => typeof id === 'string'),
    ),
  ]
  if (castAgentIds.length === 0) return events

  const [liveChars, archivedChars, agentRows] = await Promise.all([
    db
      .select({ agentId: characters.agentId, name: characters.name })
      .from(characters)
      .where(
        and(eq(characters.stageId, stageId), inArray(characters.agentId, castAgentIds)),
      ),
    db
      .select({ agentId: archivedCharacters.agentId, characterData: archivedCharacters.characterData })
      .from(archivedCharacters)
      .where(
        and(
          eq(archivedCharacters.stageId, stageId),
          inArray(archivedCharacters.agentId, castAgentIds),
        ),
      ),
    db
      .select({ id: agents.id, name: agents.name, userId: agents.userId })
      .from(agents)
      .where(inArray(agents.id, castAgentIds)),
  ])

  const charByAgent: Record<string, string | null> = {}
  for (const c of liveChars) if (c.agentId) charByAgent[c.agentId] = c.name
  for (const a of archivedChars) {
    if (a.agentId && !(a.agentId in charByAgent)) {
      const data = a.characterData as { name?: unknown } | null
      charByAgent[a.agentId] = typeof data?.name === 'string' ? data.name : null
    }
  }

  const userIds = agentRows
    .map((a) => a.userId)
    .filter((id): id is string => typeof id === 'string')
  const profiles = userIds.length
    ? await db
        .select({ userId: userProfiles.userId, displayName: userProfiles.displayName })
        .from(userProfiles)
        .where(inArray(userProfiles.userId, userIds))
    : []
  const ownerByUser: Record<string, string> = {}
  for (const p of profiles) ownerByUser[p.userId] = p.displayName

  const agentById: Record<string, { name: string | null; userId: string | null }> = {}
  for (const a of agentRows) agentById[a.id] = { name: a.name, userId: a.userId }

  return events.map((e) => {
    if ((e.type !== 'joined' && e.type !== 'left') || !e.agentId) return e
    const agent = agentById[e.agentId]
    return {
      ...e,
      characterName: charByAgent[e.agentId] ?? null,
      agentName: agent?.name ?? e.agentName ?? null,
      ownerName: agent?.userId ? (ownerByUser[agent.userId] ?? null) : null,
    }
  })
}
