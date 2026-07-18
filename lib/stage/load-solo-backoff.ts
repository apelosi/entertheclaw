import { db } from '@/lib/db/client'
import { stageEvents } from '@/lib/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import {
  countConsecutiveSoloDialogue,
  evaluateSoloBackoff,
  type SoloBackoffEvaluation,
} from '@/lib/stage/solo-backoff'

/** Enough rows to distinguish the 6+ plateau tier. */
const SOLO_DIALOGUE_LOOKBACK = 12

/**
 * Load consecutive-solo state for an agent on a stage and evaluate whether a
 * new initiative claim/speak should be refused.
 */
export async function loadSoloBackoffEvaluation(
  stageId: string,
  agentId: string,
  nowMs: number = Date.now(),
): Promise<SoloBackoffEvaluation> {
  const recentDialogueRows = await db
    .select({
      agentId: stageEvents.agentId,
      createdAt: stageEvents.createdAt,
    })
    .from(stageEvents)
    .where(and(eq(stageEvents.stageId, stageId), eq(stageEvents.type, 'dialogue')))
    .orderBy(desc(stageEvents.createdAt))
    .limit(SOLO_DIALOGUE_LOOKBACK)

  const consecutiveSoloDialogueCount = countConsecutiveSoloDialogue(
    recentDialogueRows,
    agentId,
  )
  const lastAt = recentDialogueRows[0]?.createdAt
  const lastDialogueAgoMs =
    lastAt == null ? null : Math.max(0, nowMs - new Date(lastAt).getTime())

  return evaluateSoloBackoff({
    consecutiveSoloDialogueCount,
    lastDialogueAgoMs,
  })
}
