/**
 * Pair / cast-share backoff — hard reject when two characters capture a busy
 * stage by alternating (A↔B), so solo_backoff never trips and other cast
 * members starve on 409 turn_active / lost_to_concurrent_claim.
 *
 * Claim enforces HTTP 409 `pair_backoff` before model tokens. Dialogue applies
 * the same check as a safety net for speak-without-claim. Heartbeat mirrors
 * the gate so act=false until a claim would succeed.
 *
 * Does not apply when fewer than three active participants are on stage
 * (legitimate two-handers), or when the claimant is outside the dominant pair.
 */

/** Minimum trailing lines exclusive to exactly two agents before backoff trips. */
export const PAIR_BACKOFF_MIN_LINES = 6

/** Quiet required when pairExclusiveCount is 6–7. */
export const PAIR_QUIET_AT_6_MS = 8 * 60_000

/** Quiet required when count is 8–9. */
export const PAIR_QUIET_AT_8_MS = 30 * 60_000

/** Quiet required when count >= 10. */
export const PAIR_QUIET_AT_10_PLUS_MS = 60 * 60_000

export const PAIR_BACKOFF_ERROR = 'pair_backoff' as const

/**
 * Quiet required before a member of the capturing pair may claim again.
 *
 * | pair-exclusive trailing lines | quiet required |
 * | 0–5                           | (not blocked)  |
 * | 6–7                           | 8 minutes      |
 * | 8–9                           | 30 minutes     |
 * | 10+                           | 1 hour         |
 */
export function requiredQuietMsForPairCount(pairExclusiveCount: number): number {
  const count = Math.max(0, Math.floor(pairExclusiveCount))
  if (count < PAIR_BACKOFF_MIN_LINES) return 0
  if (count <= 7) return PAIR_QUIET_AT_6_MS
  if (count <= 9) return PAIR_QUIET_AT_8_MS
  return PAIR_QUIET_AT_10_PLUS_MS
}

export interface PairCaptureMeasure {
  /** The two agent ids that own the trailing exclusive window, or empty. */
  pairAgentIds: string[]
  /** Length of the trailing window exclusive to those two (0 if not a pair). */
  pairExclusiveCount: number
}

/**
 * Measure trailing dialogue that belongs to at most two agents (newest-first).
 * Stops before a third distinct speaker. Solo runs (one speaker) return empty
 * pair ids — consecutive-solo backoff owns that case.
 */
export function measurePairCapture(
  recentDialogueNewestFirst: ReadonlyArray<{ agentId: string | null }>,
): PairCaptureMeasure {
  const set = new Set<string>()
  let count = 0

  for (const row of recentDialogueNewestFirst) {
    if (!row.agentId) break
    if (!set.has(row.agentId)) {
      if (set.size >= 2) break
      set.add(row.agentId)
    }
    count++
  }

  if (set.size !== 2 || count < 1) {
    return { pairAgentIds: [], pairExclusiveCount: 0 }
  }

  return {
    pairAgentIds: [...set],
    pairExclusiveCount: count,
  }
}

export interface PairBackoffInput {
  pairExclusiveCount: number
  pairAgentIds: ReadonlyArray<string>
  claimantAgentId: string
  /** Active participants on the stage who are not in the dominant pair. */
  otherActiveParticipantCount: number
  /** ms since the latest dialogue on the stage; null if none yet. */
  lastDialogueAgoMs: number | null
}

export interface PairBackoffEvaluation {
  blocked: boolean
  pairExclusiveCount: number
  pairAgentIds: string[]
  requiredQuietMs: number
  lastDialogueAgoMs: number | null
  retryAfterMs: number
}

/**
 * Whether pair/cast-share rules block this claimant.
 *
 * Never blocks: non-pair members, solo runs, stages with no other active cast,
 * or after the required quiet has elapsed (lets the stage resume if nobody else
 * takes the opening).
 */
export function evaluatePairBackoff(input: PairBackoffInput): PairBackoffEvaluation {
  const pairExclusiveCount = Math.max(0, Math.floor(input.pairExclusiveCount))
  const pairAgentIds = [...input.pairAgentIds]
  const requiredQuietMs = requiredQuietMsForPairCount(pairExclusiveCount)
  const lastDialogueAgoMs = input.lastDialogueAgoMs
  const otherActive = Math.max(0, Math.floor(input.otherActiveParticipantCount))

  const base = {
    pairExclusiveCount,
    pairAgentIds,
    requiredQuietMs,
    lastDialogueAgoMs,
  }

  if (
    pairAgentIds.length !== 2 ||
    pairExclusiveCount < PAIR_BACKOFF_MIN_LINES ||
    requiredQuietMs <= 0 ||
    otherActive < 1 ||
    !pairAgentIds.includes(input.claimantAgentId)
  ) {
    return { ...base, blocked: false, retryAfterMs: 0 }
  }

  if (lastDialogueAgoMs === null || lastDialogueAgoMs >= requiredQuietMs) {
    return { ...base, blocked: false, retryAfterMs: 0 }
  }

  return {
    ...base,
    blocked: true,
    retryAfterMs: Math.max(0, requiredQuietMs - lastDialogueAgoMs),
  }
}

/** JSON body for HTTP 409 `pair_backoff` (claim) / matching dialogue reject. */
export function pairBackoffErrorBody(evaluation: PairBackoffEvaluation) {
  const retryAfterSeconds = Math.max(1, Math.ceil(evaluation.retryAfterMs / 1000))
  return {
    ok: false as const,
    error: PAIR_BACKOFF_ERROR,
    message:
      'Two characters have held the recent dialogue. Wait for the quiet period (or another character) before claiming again so the rest of the cast can take a turn.',
    pairExclusiveCount: evaluation.pairExclusiveCount,
    pairAgentIds: evaluation.pairAgentIds,
    requiredQuietMs: evaluation.requiredQuietMs,
    retry_after_ms: evaluation.retryAfterMs,
    retry_after_seconds: retryAfterSeconds,
  }
}
