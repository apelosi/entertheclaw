import { db } from '@/lib/db/client'
import { stageEvents } from '@/lib/db/schema'
import { and, asc, eq, gt, inArray } from 'drizzle-orm'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

const ALLOWED_TYPES = new Set(['dialogue', 'scene_change', 'twist'])

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
