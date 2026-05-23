/**
 * Centralised producer for `turn_open` stage events.
 *
 * Emit paths:
 *   1. Inline on successful dialogue POST (immediate, no wait).
 *   2. Inline on twist insert when no grant is held.
 *   3. Safety-net tick: 60 s after the last `turn_open` or `turn_grant`
 *      with no dialogue in between, emit another `turn_open`.
 *
 * A fresh `turn_open` supersedes any prior grant.
 */
import { db } from '@/lib/db/client'
import { stageEvents, stageParticipants, stages } from '@/lib/db/schema'
import { and, desc, eq, gt, gte, inArray } from 'drizzle-orm'
import { ACTIVE_PARTICIPANT_MS, getActiveGrant } from './turn-state'
import {
  buildTurnOpenSnapshot,
  type TurnOpenSnapshot,
} from './build-turn-open-snapshot'

export const TURN_OPEN_DEDUPE_MS = 3_000
/** Re-ping if no dialogue within this window after turn_open or turn_grant. */
export const AWAITING_RESPONSE_MS = 60_000

/**
 * Why a `turn_open` was emitted. Diagnostic only — agents act on the
 * snapshot regardless of reason.
 */
export type TurnOpenReason = 'dialogue' | 'twist' | 'safety_net'

export interface TurnOpenContent {
  reason: TurnOpenReason
  emittedAt: string
  causedByEventId?: string
  sceneChanged?: boolean
  snapshot: TurnOpenSnapshot
}

export interface EmitTurnOpenOptions {
  reason: TurnOpenReason
  causedByEventId?: string
  sceneChanged?: boolean
  /** Skip when another agent holds a live grant (default true). */
  respectActiveGrant?: boolean
  /** Skip if another turn_open landed in the last TURN_OPEN_DEDUPE_MS (default true). */
  applyDedupe?: boolean
}

export type EmitTurnOpenResult =
  | { emitted: true; eventId: string }
  | { emitted: false; skipped: 'deduped' | 'grant_held' | 'stage_inactive' }

export async function emitTurnOpen(
  stageId: string,
  opts: EmitTurnOpenOptions,
): Promise<EmitTurnOpenResult> {
  const respectActiveGrant = opts.respectActiveGrant !== false
  const applyDedupe = opts.applyDedupe !== false

  if (respectActiveGrant) {
    const grant = await getActiveGrant(stageId)
    if (grant) {
      return { emitted: false, skipped: 'grant_held' }
    }
  }

  if (applyDedupe) {
    const dedupeCutoff = new Date(Date.now() - TURN_OPEN_DEDUPE_MS)
    const [recentOpen] = await db
      .select({ id: stageEvents.id })
      .from(stageEvents)
      .where(
        and(
          eq(stageEvents.stageId, stageId),
          eq(stageEvents.type, 'turn_open'),
          gte(stageEvents.createdAt, dedupeCutoff),
        ),
      )
      .orderBy(desc(stageEvents.createdAt))
      .limit(1)
    if (recentOpen) {
      return { emitted: false, skipped: 'deduped' }
    }
  }

  const snapshot = await buildTurnOpenSnapshot(stageId)
  const content: TurnOpenContent = {
    reason: opts.reason,
    emittedAt: new Date().toISOString(),
    snapshot,
    ...(opts.causedByEventId ? { causedByEventId: opts.causedByEventId } : {}),
    ...(opts.sceneChanged !== undefined
      ? { sceneChanged: opts.sceneChanged }
      : {}),
  }

  const [event] = await db
    .insert(stageEvents)
    .values({
      stageId,
      type: 'turn_open',
      content,
    })
    .returning({ id: stageEvents.id })

  return { emitted: true, eventId: event.id }
}

/**
 * True when the stage last received a `turn_open` or `turn_grant`, no
 * dialogue has arrived since, and at least AWAITING_RESPONSE_MS has elapsed.
 * Grant expiry uses the same clock (grant TTL == AWAITING_RESPONSE_MS).
 */
export async function stageNeedsSafetyNetTurnOpen(
  stageId: string,
): Promise<boolean> {
  const [lastSignal] = await db
    .select({ createdAt: stageEvents.createdAt })
    .from(stageEvents)
    .where(
      and(
        eq(stageEvents.stageId, stageId),
        inArray(stageEvents.type, ['turn_open', 'turn_grant']),
      ),
    )
    .orderBy(desc(stageEvents.createdAt))
    .limit(1)

  if (!lastSignal?.createdAt) return false

  const elapsedMs = Date.now() - lastSignal.createdAt.getTime()
  if (elapsedMs < AWAITING_RESPONSE_MS) return false

  const [dialogueAfter] = await db
    .select({ id: stageEvents.id })
    .from(stageEvents)
    .where(
      and(
        eq(stageEvents.stageId, stageId),
        eq(stageEvents.type, 'dialogue'),
        gt(stageEvents.createdAt, lastSignal.createdAt),
      ),
    )
    .limit(1)
  if (dialogueAfter) return false

  const grant = await getActiveGrant(stageId)
  if (grant) return false

  return true
}

interface SafetyNetResult {
  scanned: number
  emitted: number
  stageIds: string[]
}

/**
 * Cron safety net: re-emit `turn_open` on any multi-agent stage that has
 * gone AWAITING_RESPONSE_MS without dialogue after the last turn_open or
 * turn_grant. This is not how 30-min agents wake up (push channel later);
 * it re-opens the floor for listening runtimes and SSE subscribers.
 *
 * Netlify cron minimum is 1 minute, so the re-ping may land at 60-120 s
 * after the silence threshold in production.
 */
export async function emitTurnOpenSafetyNet(): Promise<SafetyNetResult> {
  const activeStages = await db
    .select({ id: stages.id })
    .from(stages)
    .where(eq(stages.isActive, true))

  let emitted = 0
  const emittedIds: string[] = []

  for (const { id: stageId } of activeStages) {
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
    if (activeParts.length < 2) continue

    if (!(await stageNeedsSafetyNetTurnOpen(stageId))) continue

    const result = await emitTurnOpen(stageId, {
      reason: 'safety_net',
      applyDedupe: false,
    })
    if (result.emitted) {
      emitted += 1
      emittedIds.push(stageId)
    }
  }

  return { scanned: activeStages.length, emitted, stageIds: emittedIds }
}
