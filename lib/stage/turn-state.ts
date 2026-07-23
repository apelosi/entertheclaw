import { db } from '@/lib/db/client'
import { stageEvents, stageParticipants } from '@/lib/db/schema'
import { and, desc, eq, gte, max } from 'drizzle-orm'

// Tunable protocol constants. See docs/agents/turn-protocol.md.
export const COLLECTION_WINDOW_MS = 1000
export const GRANT_TTL_MS = 60_000
export const ACTIVE_RECENT_EVENT_MS = 10 * 60 * 1000 // stage is "active" if dialogue/twist within 10min
export const ACTIVE_PARTICIPANT_MS = 60 * 60 * 1000 // participant is "active" if heartbeat within 1h
export const PULSE_HINT_ACTIVE_MS = 10_000
// Plain idle sleep hint (15 min). Deliberately under common ~30 min
// idle-container reap windows (NanoClaw etc.). Not wall-clock fleet-aligned —
// third-party agents often ignore retryAfterMs; see VV-20 revision.
export const PULSE_HINT_IDLE_MS = 15 * 60 * 1000

export interface ActiveGrant {
  agentId: string
  characterId: string | null
  claimId: string
  expiresAt: string
  grantedAt: string
}

export interface ClaimContent {
  claimId: string
  stake: number
  intent?: string
}

export interface GrantContent {
  claimId: string
  agentId: string
  characterId: string | null
  grantedAt: string
  expiresAt: string
}

/**
 * Look at recent stage events and decide if a turn_grant is currently live.
 * A grant is live if:
 *  - it is the latest turn_grant within the look-back window
 *  - its expiresAt is in the future
 *  - no dialogue from the granted agent occurred AFTER the grant (consumed)
 */
export async function getActiveGrant(stageId: string): Promise<ActiveGrant | null> {
  const lookback = new Date(Date.now() - GRANT_TTL_MS - 5000)
  const rows = await db
    .select()
    .from(stageEvents)
    .where(
      and(
        eq(stageEvents.stageId, stageId),
        gte(stageEvents.createdAt, lookback),
      ),
    )
    .orderBy(desc(stageEvents.createdAt))
    .limit(50)

  const lastGrant = rows.find((r) => r.type === 'turn_grant')
  if (!lastGrant) return null

  const c = lastGrant.content as GrantContent | null
  if (!c) return null
  const expires = new Date(c.expiresAt).getTime()
  if (Number.isNaN(expires) || expires <= Date.now()) return null

  const grantTimeMs = lastGrant.createdAt?.getTime() ?? 0
  const consumed = rows.some(
    (r) =>
      r.type === 'dialogue' &&
      r.agentId === c.agentId &&
      (r.createdAt?.getTime() ?? 0) > grantTimeMs,
  )
  if (consumed) return null

  return c
}

/**
 * Compute "last spoken at" per agent on this stage.
 * Used as the LRU tiebreak when claims tie on stake.
 */
export async function getLastSpokenMap(stageId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({
      agentId: stageEvents.agentId,
      lastAt: max(stageEvents.createdAt),
    })
    .from(stageEvents)
    .where(and(eq(stageEvents.stageId, stageId), eq(stageEvents.type, 'dialogue')))
    .groupBy(stageEvents.agentId)

  const map = new Map<string, number>()
  for (const r of rows) {
    if (!r.agentId) continue
    map.set(r.agentId, r.lastAt ? new Date(r.lastAt).getTime() : 0)
  }
  return map
}

interface ClaimRow {
  id: string
  agentId: string | null
  createdAt: Date | null
  content: unknown
}

/**
 * Deterministic claim resolution. Every caller computes the same answer.
 * Order: highest stake desc, then LRU (least-recently-spoken) asc, then agentId asc.
 * agentId asc is the final tiebreak so the result is fully deterministic.
 */
export function pickClaimWinner<T extends ClaimRow>(
  claims: T[],
  lastSpokenMs: Map<string, number>,
): T | null {
  if (claims.length === 0) return null
  const sorted = [...claims].sort((a, b) => {
    const ca = (a.content as ClaimContent | null)?.stake ?? 5
    const cb = (b.content as ClaimContent | null)?.stake ?? 5
    if (cb !== ca) return cb - ca
    const la = lastSpokenMs.get(a.agentId ?? '') ?? 0
    const lb = lastSpokenMs.get(b.agentId ?? '') ?? 0
    if (la !== lb) return la - lb
    return (a.agentId ?? '').localeCompare(b.agentId ?? '')
  })
  return sorted[0] ?? null
}

/**
 * Active = has a dialogue/twist event within ACTIVE_RECENT_EVENT_MS
 * AND has at least 2 participants whose lastActiveAt is within ACTIVE_PARTICIPANT_MS.
 * Otherwise idle.
 */
export async function classifyStageActivity(stageId: string): Promise<'active' | 'idle'> {
  const recentCutoff = new Date(Date.now() - ACTIVE_RECENT_EVENT_MS)
  const recentRows = await db
    .select({ type: stageEvents.type })
    .from(stageEvents)
    .where(and(eq(stageEvents.stageId, stageId), gte(stageEvents.createdAt, recentCutoff)))
    .limit(20)
  const hasRecentActivity = recentRows.some(
    (r) => r.type === 'dialogue' || r.type === 'twist' || r.type === 'scene_change',
  )
  if (!hasRecentActivity) return 'idle'

  const activeCutoff = new Date(Date.now() - ACTIVE_PARTICIPANT_MS)
  const activeParts = await db
    .select({ id: stageParticipants.id })
    .from(stageParticipants)
    .where(
      and(
        eq(stageParticipants.stageId, stageId),
        gte(stageParticipants.lastActiveAt, activeCutoff),
      ),
    )
  if (activeParts.length < 2) return 'idle'
  return 'active'
}

/**
 * Returns the createdAt of the latest dialogue event for this stage, in ms epoch.
 * Returns null if the stage has never had a dialogue event.
 */
export async function getLastDialogueAt(stageId: string): Promise<number | null> {
  const [row] = await db
    .select({ createdAt: stageEvents.createdAt })
    .from(stageEvents)
    .where(and(eq(stageEvents.stageId, stageId), eq(stageEvents.type, 'dialogue')))
    .orderBy(desc(stageEvents.createdAt))
    .limit(1)
  if (!row?.createdAt) return null
  return new Date(row.createdAt).getTime()
}
