import { db } from '@/lib/db/client'
import { stageEvents } from '@/lib/db/schema'
import { and, asc, desc, eq, gt, lt, or, inArray } from 'drizzle-orm'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

const ALLOWED_TYPES = new Set(['dialogue', 'scene_change', 'twist'])

// Separate allowlist for the feed endpoint (includes cast join/leave rows).
// The agent-facing /events?types= allowlist above is intentionally untouched.
const FEED_ALLOWED_TYPES = new Set([
  'dialogue',
  'scene_change',
  'twist',
  'joined',
  'left',
])

export function parseEventTypesParam(raw: string | null): string[] | null {
  if (!raw?.trim()) return null
  const types = raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  if (types.length === 0) return null
  for (const t of types) {
    if (!ALLOWED_TYPES.has(t)) {
      return null
    }
  }
  return types
}

export function parseEventsLimit(raw: string | null): number {
  const n = raw ? Number.parseInt(raw, 10) : DEFAULT_LIMIT
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT
  return Math.min(n, MAX_LIMIT)
}

const FEED_DEFAULT_LIMIT = 20
const FEED_MAX_LIMIT = 100

export function parseFeedEventTypesParam(raw: string | null): string[] | null {
  if (!raw?.trim()) return null
  const types = raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  if (types.length === 0) return null
  for (const t of types) {
    if (!FEED_ALLOWED_TYPES.has(t)) {
      return null
    }
  }
  return types
}

export function parseFeedLimit(raw: string | null): number {
  const n = raw ? Number.parseInt(raw, 10) : FEED_DEFAULT_LIMIT
  if (!Number.isFinite(n) || n < 1) return FEED_DEFAULT_LIMIT
  return Math.min(n, FEED_MAX_LIMIT)
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function resolveSinceCursor(
  stageId: string,
  since: string,
): Promise<Date | null> {
  if (UUID_RE.test(since)) {
    const [row] = await db
      .select({ createdAt: stageEvents.createdAt })
      .from(stageEvents)
      .where(and(eq(stageEvents.stageId, stageId), eq(stageEvents.id, since)))
      .limit(1)
    return row?.createdAt ?? null
  }
  const parsed = Date.parse(since)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed)
}

export async function queryFilteredStageEvents(opts: {
  stageId: string
  types: string[]
  since?: string | null
  limit: number
}) {
  const { stageId, types, since, limit } = opts
  let sinceAt: Date | null = null
  if (since?.trim()) {
    sinceAt = await resolveSinceCursor(stageId, since.trim())
    if (!sinceAt) {
      return { error: 'invalid_since' as const }
    }
  }

  const conditions = [
    eq(stageEvents.stageId, stageId),
    inArray(stageEvents.type, types as ('dialogue' | 'scene_change' | 'twist')[]),
  ]
  if (sinceAt) {
    conditions.push(gt(stageEvents.createdAt, sinceAt))
  }

  const rows = await db
    .select()
    .from(stageEvents)
    .where(and(...conditions))
    .orderBy(asc(stageEvents.createdAt))
    .limit(limit)

  return { events: rows }
}

/**
 * Resolves a feed `before` cursor (an event id) to that event's createdAt,
 * scoped to the given stage. Returns null if the event doesn't exist on
 * this stage.
 */
export async function resolveBeforeCursor(
  stageId: string,
  before: string,
): Promise<Date | null> {
  const [row] = await db
    .select({ createdAt: stageEvents.createdAt })
    .from(stageEvents)
    .where(and(eq(stageEvents.stageId, stageId), eq(stageEvents.id, before)))
    .limit(1)
  return row?.createdAt ?? null
}

/**
 * Backward pagination for the feed endpoint: events strictly older than
 * `before` (an event id), newest-first. Fetches `limit + 1` rows so the
 * caller can derive `hasMore` without a separate count query.
 *
 * Ordering and the cursor both use (createdAt, id) — createdAt alone is not
 * unique (rows inserted in one transaction share a timestamp), so a
 * timestamp-only cursor can skip rows between pages.
 */
export async function queryStageEventsBefore(opts: {
  stageId: string
  types: string[]
  before?: string | null
  limit: number
}) {
  const { stageId, types, before, limit } = opts
  const beforeId = before?.trim() || null
  let beforeAt: Date | null = null
  if (beforeId) {
    beforeAt = await resolveBeforeCursor(stageId, beforeId)
    if (!beforeAt) {
      return { error: 'invalid_before' as const }
    }
  }

  const conditions = [
    eq(stageEvents.stageId, stageId),
    inArray(
      stageEvents.type,
      types as ('dialogue' | 'scene_change' | 'twist' | 'joined' | 'left')[],
    ),
  ]
  if (beforeAt && beforeId) {
    conditions.push(
      or(
        lt(stageEvents.createdAt, beforeAt),
        and(eq(stageEvents.createdAt, beforeAt), lt(stageEvents.id, beforeId)),
      )!,
    )
  }

  const rows = await db
    .select()
    .from(stageEvents)
    .where(and(...conditions))
    .orderBy(desc(stageEvents.createdAt), desc(stageEvents.id))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  return { events: hasMore ? rows.slice(0, limit) : rows, hasMore }
}
