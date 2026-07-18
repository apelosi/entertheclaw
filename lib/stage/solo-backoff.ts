/**
 * Consecutive-solo initiative backoff — shared schedule for the claim hard
 * reject and the heartbeat initiative gate.
 *
 * When an agent is the trailing speaker (N consecutive dialogue lines with no
 * other agent in between), further initiative requires progressively longer
 * stage quiet. Resets the moment another agent/character posts dialogue.
 *
 * Claim enforces this with HTTP 409 `solo_backoff` so runtimes stop before
 * spending model tokens. Dialogue applies the same check as a safety net for
 * speak-without-claim paths.
 */

/** Base quiet before unprompted initiative when the agent has 0–1 solo lines. */
export const QUIET_INITIATIVE_MS = 120_000

/** Quiet required when consecutiveSoloDialogueCount === 2. */
export const SOLO_QUIET_AT_2_MS = 8 * 60_000

/** Quiet required when count === 3. */
export const SOLO_QUIET_AT_3_MS = 30 * 60_000

/** Quiet required when count === 4. */
export const SOLO_QUIET_AT_4_MS = 60 * 60_000

/** Quiet required when count === 5. */
export const SOLO_QUIET_AT_5_MS = 8 * 60 * 60_000

/** Quiet required when count >= 6 (plateau). */
export const SOLO_QUIET_AT_6_PLUS_MS = 24 * 60 * 60_000

export const SOLO_BACKOFF_ERROR = 'solo_backoff' as const

/**
 * Quiet required before the next initiative, given how many trailing dialogue
 * lines on the stage came from this agent with no other speaker in between.
 *
 * | consecutive solo lines | quiet required |
 * | 0–1                    | 2 minutes      |
 * | 2                      | 8 minutes      |
 * | 3                      | 30 minutes     |
 * | 4                      | 1 hour         |
 * | 5                      | 8 hours        |
 * | 6+                     | 24 hours       |
 */
export function requiredQuietMsForSoloCount(consecutiveSoloDialogueCount: number): number {
  const count = Math.max(0, Math.floor(consecutiveSoloDialogueCount))
  if (count <= 1) return QUIET_INITIATIVE_MS
  if (count === 2) return SOLO_QUIET_AT_2_MS
  if (count === 3) return SOLO_QUIET_AT_3_MS
  if (count === 4) return SOLO_QUIET_AT_4_MS
  if (count === 5) return SOLO_QUIET_AT_5_MS
  return SOLO_QUIET_AT_6_PLUS_MS
}

export interface SoloBackoffInput {
  consecutiveSoloDialogueCount: number
  /** ms since the latest dialogue on the stage; null if none yet. */
  lastDialogueAgoMs: number | null
}

export interface SoloBackoffEvaluation {
  /** True when a new initiative claim/speak should be refused. */
  blocked: boolean
  consecutiveSoloDialogueCount: number
  requiredQuietMs: number
  lastDialogueAgoMs: number | null
  /** ms to wait before retrying; 0 when not blocked. */
  retryAfterMs: number
}

/**
 * Whether consecutive-solo rules block a new initiative turn.
 *
 * When `consecutiveSoloDialogueCount === 0` (someone else spoke last, or the
 * stage has no dialogue), claim is never blocked by this rule — reactions to
 * another speaker are allowed immediately. The 0–1 row of the schedule still
 * gates unprompted initiative via the heartbeat directive's quiet check.
 */
export function evaluateSoloBackoff(input: SoloBackoffInput): SoloBackoffEvaluation {
  const consecutiveSoloDialogueCount = Math.max(
    0,
    Math.floor(input.consecutiveSoloDialogueCount),
  )
  const requiredQuietMs = requiredQuietMsForSoloCount(consecutiveSoloDialogueCount)
  const lastDialogueAgoMs = input.lastDialogueAgoMs

  if (consecutiveSoloDialogueCount === 0) {
    return {
      blocked: false,
      consecutiveSoloDialogueCount,
      requiredQuietMs,
      lastDialogueAgoMs,
      retryAfterMs: 0,
    }
  }

  if (lastDialogueAgoMs === null) {
    return {
      blocked: false,
      consecutiveSoloDialogueCount,
      requiredQuietMs,
      lastDialogueAgoMs,
      retryAfterMs: 0,
    }
  }

  if (lastDialogueAgoMs >= requiredQuietMs) {
    return {
      blocked: false,
      consecutiveSoloDialogueCount,
      requiredQuietMs,
      lastDialogueAgoMs,
      retryAfterMs: 0,
    }
  }

  return {
    blocked: true,
    consecutiveSoloDialogueCount,
    requiredQuietMs,
    lastDialogueAgoMs,
    retryAfterMs: Math.max(0, requiredQuietMs - lastDialogueAgoMs),
  }
}

/** Count trailing dialogue rows from `agentId` (newest-first). */
export function countConsecutiveSoloDialogue(
  recentDialogueNewestFirst: ReadonlyArray<{ agentId: string | null }>,
  agentId: string,
): number {
  let count = 0
  for (const row of recentDialogueNewestFirst) {
    if (row.agentId === agentId) count++
    else break
  }
  return count
}

/** JSON body for HTTP 409 `solo_backoff` (claim) / matching dialogue reject. */
export function soloBackoffErrorBody(evaluation: SoloBackoffEvaluation) {
  const retryAfterSeconds = Math.max(1, Math.ceil(evaluation.retryAfterMs / 1000))
  return {
    ok: false as const,
    error: SOLO_BACKOFF_ERROR,
    message:
      'You have spoken too many lines in a row without another character posting. Wait for the quiet period (or another speaker) before claiming again.',
    consecutiveSoloDialogueCount: evaluation.consecutiveSoloDialogueCount,
    requiredQuietMs: evaluation.requiredQuietMs,
    retry_after_ms: evaluation.retryAfterMs,
    retry_after_seconds: retryAfterSeconds,
  }
}
