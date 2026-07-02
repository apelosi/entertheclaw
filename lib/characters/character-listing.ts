/**
 * Unified character listing: merges LIVE characters (still on a stage) with
 * ARCHIVED characters (pulled/timed-out/evicted — a separate table since
 * archival deletes the live row, see lib/stages/enrollment.ts). A character's
 * status mirrors its owning agent's while live (active/idle/inactive); once
 * archived it's always 'retired' — a terminal, still-visible status, not a
 * reason to hide it.
 *
 * Merged in application code rather than a SQL UNION: character volume is low
 * right now and the two tables need different field extraction (archived
 * pulls name/occupation/imageUrl out of a jsonb snapshot) — revisit if/when
 * pagination at scale becomes necessary.
 *
 * Deliberately does NOT filter by completeness — callers apply their own
 * existing (and slightly different) isComplete policy on the returned array.
 */
import { and, desc, eq, isNotNull, not, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { agents, archivedCharacters, characters, stages } from '@/lib/db/schema'
import type { CharacterStatus } from '@/components/characters/character-card'

export type { CharacterStatus }

export interface CharacterListRow {
  id: string
  name: string | null
  occupation: string | null
  imageUrl: string | null
  /** Never actually null — both source columns are NOT NULL — but stageName
   *  (a LEFT JOIN) can be, if the stage row itself is somehow gone. */
  stageId: string
  stageName: string | null
  agentName: string | null
  isComplete: boolean | null
  status: CharacterStatus | null
  isArchived: boolean
}

/** Same test-data exclusion as lib/agents/community-visibility.ts — kept
 *  local since that module doesn't export it and this only needs it for the
 *  community (no userId) case. */
function isTestAgentWhere() {
  return or(
    eq(agents.userId, 'smoke-test-user'),
    sql`${agents.userId} like 'verify-%'`,
    sql`lower(${agents.name}) like 'verifyagent%'`,
    sql`lower(${agents.name}) like 'smoketestagent%'`,
  )!
}

export async function getCharactersWithStatus(opts: {
  userId?: string
}): Promise<CharacterListRow[]> {
  const { userId } = opts

  const liveWhere = userId
    ? and(eq(agents.userId, userId), isNotNull(agents.name))
    : and(isNotNull(agents.name), not(isTestAgentWhere()))

  const archivedWhere = userId
    ? and(eq(agents.userId, userId), isNotNull(agents.name))
    : and(isNotNull(agents.name), not(isTestAgentWhere()))

  const [liveRows, archivedRows] = await Promise.all([
    db
      .select({
        id: characters.id,
        name: characters.name,
        occupation: characters.occupation,
        imageUrl: characters.imageUrl,
        isComplete: characters.isComplete,
        stageId: characters.stageId,
        stageName: stages.name,
        agentName: agents.name,
        status: agents.status,
        sortDate: characters.updatedAt,
      })
      .from(characters)
      .innerJoin(agents, eq(characters.agentId, agents.id))
      .leftJoin(stages, eq(stages.id, characters.stageId))
      .where(liveWhere)
      .orderBy(desc(characters.updatedAt)),
    db
      .select({
        id: archivedCharacters.originalCharacterId,
        name: sql<string | null>`${archivedCharacters.characterData}->>'name'`,
        occupation: sql<string | null>`${archivedCharacters.characterData}->>'occupation'`,
        imageUrl: sql<string | null>`${archivedCharacters.characterData}->>'imageUrl'`,
        isComplete: sql<boolean | null>`(${archivedCharacters.characterData}->>'isComplete')::boolean`,
        stageId: archivedCharacters.stageId,
        stageName: stages.name,
        agentName: agents.name,
        sortDate: archivedCharacters.archivedAt,
      })
      .from(archivedCharacters)
      .innerJoin(agents, eq(archivedCharacters.agentId, agents.id))
      .leftJoin(stages, eq(stages.id, archivedCharacters.stageId))
      .where(archivedWhere)
      .orderBy(desc(archivedCharacters.archivedAt)),
  ])

  const merged: (CharacterListRow & { sortDate: Date | null })[] = [
    ...liveRows.map((r) => ({
      id: r.id,
      name: r.name,
      occupation: r.occupation,
      imageUrl: r.imageUrl,
      isComplete: r.isComplete,
      stageId: r.stageId,
      stageName: r.stageName,
      agentName: r.agentName,
      status: (r.status as CharacterStatus | null) ?? null,
      isArchived: false,
      sortDate: r.sortDate,
    })),
    ...archivedRows
      .filter((r): r is typeof r & { id: string } => r.id != null)
      .map((r) => ({
        id: r.id,
        name: r.name,
        occupation: r.occupation,
        imageUrl: r.imageUrl,
        isComplete: r.isComplete,
        stageId: r.stageId,
        stageName: r.stageName,
        agentName: r.agentName,
        status: 'retired' as const,
        isArchived: true,
        sortDate: r.sortDate,
      })),
  ]

  merged.sort((a, b) => (b.sortDate?.getTime() ?? 0) - (a.sortDate?.getTime() ?? 0))
  return merged.map(({ sortDate: _sortDate, ...rest }) => rest)
}
