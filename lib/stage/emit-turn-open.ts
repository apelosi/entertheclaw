import { db } from '@/lib/db/client'
import { stageEvents, stageParticipants, stages } from '@/lib/db/schema'
import { and, desc, eq, gte } from 'drizzle-orm'
import {
  ACTIVE_PARTICIPANT_MS,
  ACTIVE_RECENT_EVENT_MS,
  SCENE_QUIET_MS,
  getActiveGrant,
  getLastDialogueAt,
} from './turn-state'

const RECENT_TURN_OPEN_DEDUPE_MS = SCENE_QUIET_MS

/**
 * For every "active" stage (recent activity + at least 2 active participants),
 * emit a `turn_open` event when:
 *   - no live grant
 *   - last dialogue was at least SCENE_QUIET_MS ago (or never)
 *   - no other turn_open event has been emitted in the last RECENT_TURN_OPEN_DEDUPE_MS
 *
 * Returns the count of stages that received a fresh turn_open this tick.
 */
export async function emitTurnOpenForQuietStages(): Promise<{
  scanned: number
  opened: number
  stageIds: string[]
}> {
  // Find candidate stages: active flag, with at least 2 recently-active participants.
  const activeCutoff = new Date(Date.now() - ACTIVE_PARTICIPANT_MS)
  const allActive = await db
    .select({ id: stages.id })
    .from(stages)
    .where(eq(stages.isActive, true))

  const stageIds = allActive.map((s) => s.id)
  let opened = 0
  const opens: string[] = []

  for (const stageId of stageIds) {
    // Activity gate
    const recentEventCutoff = new Date(Date.now() - ACTIVE_RECENT_EVENT_MS)
    const recentEvents = await db
      .select({ type: stageEvents.type, createdAt: stageEvents.createdAt })
      .from(stageEvents)
      .where(
        and(eq(stageEvents.stageId, stageId), gte(stageEvents.createdAt, recentEventCutoff)),
      )
      .orderBy(desc(stageEvents.createdAt))
      .limit(20)

    const hasNarrativeActivity = recentEvents.some(
      (e) => e.type === 'dialogue' || e.type === 'twist' || e.type === 'scene_change',
    )
    if (!hasNarrativeActivity) continue

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

    // Skip if a grant is currently held
    const grant = await getActiveGrant(stageId)
    if (grant) continue

    // Skip if dialogue is too recent (still in scene-quiet window)
    const lastDialogueAt = await getLastDialogueAt(stageId)
    if (lastDialogueAt !== null && Date.now() - lastDialogueAt < SCENE_QUIET_MS) continue

    // Dedupe: skip if a turn_open already exists in the last RECENT_TURN_OPEN_DEDUPE_MS
    const dedupeCutoff = new Date(Date.now() - RECENT_TURN_OPEN_DEDUPE_MS)
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
    if (recentOpen) continue

    await db.insert(stageEvents).values({
      stageId,
      type: 'turn_open',
      content: {
        reason: 'scene_quiet',
        lastDialogueAgoMs:
          lastDialogueAt === null ? null : Date.now() - lastDialogueAt,
        openedAt: new Date().toISOString(),
      },
    })
    opened += 1
    opens.push(stageId)
  }

  return { scanned: stageIds.length, opened, stageIds: opens }
}
