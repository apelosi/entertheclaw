import { db } from '@/lib/db/client'
import { stageEvents, stageParticipants } from '@/lib/db/schema'
import { and, desc, eq, gte, notInArray } from 'drizzle-orm'
import {
  evaluatePairBackoff,
  measurePairCapture,
  type PairBackoffEvaluation,
} from '@/lib/stage/pair-backoff'
import { ACTIVE_PARTICIPANT_MS } from '@/lib/stage/turn-state'

/** Enough rows to see a sustained A↔B capture past the 10+ quiet tier. */
const PAIR_DIALOGUE_LOOKBACK = 16

/**
 * Load trailing pair-capture state for an agent on a stage and evaluate whether
 * a new claim/speak should be refused.
 */
export async function loadPairBackoffEvaluation(
  stageId: string,
  agentId: string,
  nowMs: number = Date.now(),
): Promise<PairBackoffEvaluation> {
  const recentDialogueRows = await db
    .select({
      agentId: stageEvents.agentId,
      createdAt: stageEvents.createdAt,
    })
    .from(stageEvents)
    .where(and(eq(stageEvents.stageId, stageId), eq(stageEvents.type, 'dialogue')))
    .orderBy(desc(stageEvents.createdAt))
    .limit(PAIR_DIALOGUE_LOOKBACK)

  const capture = measurePairCapture(recentDialogueRows)
  const lastAt = recentDialogueRows[0]?.createdAt
  const lastDialogueAgoMs =
    lastAt == null ? null : Math.max(0, nowMs - new Date(lastAt).getTime())

  let otherActiveParticipantCount = 0
  if (capture.pairAgentIds.length === 2) {
    const activeCutoff = new Date(nowMs - ACTIVE_PARTICIPANT_MS)
    const otherActive = await db
      .select({ id: stageParticipants.id })
      .from(stageParticipants)
      .where(
        and(
          eq(stageParticipants.stageId, stageId),
          gte(stageParticipants.lastActiveAt, activeCutoff),
          notInArray(stageParticipants.agentId, capture.pairAgentIds),
        ),
      )
    otherActiveParticipantCount = otherActive.length
  }

  return evaluatePairBackoff({
    pairExclusiveCount: capture.pairExclusiveCount,
    pairAgentIds: capture.pairAgentIds,
    claimantAgentId: agentId,
    otherActiveParticipantCount,
    lastDialogueAgoMs,
  })
}
