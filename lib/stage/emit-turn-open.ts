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
import { and, desc, eq, gt, gte, inArray, sql } from 'drizzle-orm'
import {
  ACTIVE_PARTICIPANT_MS,
  getActiveGrant,
  getLastDialogueAt,
} from './turn-state'
import {
  buildTurnOpenSnapshot,
  type TurnOpenSnapshot,
} from './build-turn-open-snapshot'
import { deliverTurnWebhooks } from './deliver-turn-webhooks'

export const TURN_OPEN_DEDUPE_MS = 3_000
/** Re-ping if no dialogue within this window after turn_open or turn_grant. */
export const AWAITING_RESPONSE_MS = 60_000
/**
 * Stop re-emitting safety-net `turn_open` once a stage has been silent (no
 * dialogue) longer than this. Heartbeating-but-mute agents keep a stage's
 * participants "active" indefinitely, so without this the safety net re-opens
 * the floor every tick forever — the source of the 26k+ turn_open pile-up.
 * A waking agent still discovers the open floor via its heartbeat's live
 * turnState, so giving up on the push costs it nothing.
 */
export const SAFETY_NET_MAX_SILENCE_MS = 60 * 60 * 1000

/**
 * Why a `turn_open` was emitted. Diagnostic only — agents act on the
 * snapshot regardless of reason.
 */
export type TurnOpenReason = 'dialogue' | 'twist' | 'safety_net' | 'wake'

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
    .returning({ id: stageEvents.id, createdAt: stageEvents.createdAt })

  const createdAt =
    event.createdAt?.toISOString() ?? new Date().toISOString()
  deliverTurnWebhooks(stageId, {
    type: 'turn_open',
    stageId,
    eventId: event.id,
    createdAt,
    content,
  })

  return { emitted: true, eventId: event.id }
}

/** True if this stage has ever received turn_open or turn_grant. */
export async function stageHasTurnProtocolSignals(
  stageId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: stageEvents.id })
    .from(stageEvents)
    .where(
      and(
        eq(stageEvents.stageId, stageId),
        inArray(stageEvents.type, ['turn_open', 'turn_grant']),
      ),
    )
    .limit(1)
  return !!row
}

async function stageMainParticipantCount(stageId: string): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(stageParticipants)
    .where(eq(stageParticipants.stageId, stageId))
  return Number(count ?? 0)
}

/**
 * True when the stage last received a `turn_open` or `turn_grant`, no
 * dialogue has arrived since, and at least AWAITING_RESPONSE_MS has elapsed.
 *
 * Bootstrap: stages that had dialogue before turn protocol shipped never got an
 * initial turn_open. When there is no prior signal, emit once the last dialogue
 * is at least AWAITING_RESPONSE_MS old (same clock as the normal re-ping).
 */
export async function stageNeedsSafetyNetTurnOpen(
  stageId: string,
): Promise<boolean> {
  const grant = await getActiveGrant(stageId)
  if (grant) return false

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

  if (!lastSignal?.createdAt) {
    const participants = await stageMainParticipantCount(stageId)
    if (participants < 2) return false

    const [lastDialogue] = await db
      .select({ createdAt: stageEvents.createdAt })
      .from(stageEvents)
      .where(
        and(
          eq(stageEvents.stageId, stageId),
          eq(stageEvents.type, 'dialogue'),
        ),
      )
      .orderBy(desc(stageEvents.createdAt))
      .limit(1)
    if (!lastDialogue?.createdAt) return false

    const elapsedMs = Date.now() - lastDialogue.createdAt.getTime()
    return elapsedMs >= AWAITING_RESPONSE_MS
  }

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
    // Give up nudging a stage that has been silent too long — the agents
    // aren't responding to the open floor, so re-emitting turn_open just
    // churns the DB. Real activity resets this via the inline emit paths.
    const lastDialogueAt = await getLastDialogueAt(stageId)
    if (
      lastDialogueAt === null ||
      Date.now() - lastDialogueAt > SAFETY_NET_MAX_SILENCE_MS
    ) {
      continue
    }

    const hasSignals = await stageHasTurnProtocolSignals(stageId)
    if (hasSignals) {
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
    } else {
      const participants = await stageMainParticipantCount(stageId)
      if (participants < 2) continue
    }

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
