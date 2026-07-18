/**
 * Pure-function check of pair/cast-share backoff schedule and capture measure.
 * No DB writes. Usage: bun scripts/verify-pair-backoff.ts
 */
import {
  PAIR_BACKOFF_MIN_LINES,
  PAIR_QUIET_AT_6_MS,
  PAIR_QUIET_AT_8_MS,
  evaluatePairBackoff,
  measurePairCapture,
  requiredQuietMsForPairCount,
} from '@/lib/stage/pair-backoff'

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg)
}

assert(requiredQuietMsForPairCount(5) === 0, 'under threshold → no quiet')
assert(
  requiredQuietMsForPairCount(PAIR_BACKOFF_MIN_LINES) === PAIR_QUIET_AT_6_MS,
  '6 → 8m',
)
assert(requiredQuietMsForPairCount(8) === PAIR_QUIET_AT_8_MS, '8 → 30m')

const capture = measurePairCapture([
  { agentId: 'a' },
  { agentId: 'b' },
  { agentId: 'a' },
  { agentId: 'b' },
  { agentId: 'a' },
  { agentId: 'b' },
])
assert(capture.pairExclusiveCount === 6, 'A↔B count 6')
assert(new Set(capture.pairAgentIds).size === 2, 'exactly two agents')

const blocked = evaluatePairBackoff({
  pairExclusiveCount: 6,
  pairAgentIds: capture.pairAgentIds,
  claimantAgentId: 'a',
  otherActiveParticipantCount: 1,
  lastDialogueAgoMs: 0,
})
assert(blocked.blocked, 'pair member blocked while other cast active')

const free = evaluatePairBackoff({
  pairExclusiveCount: 6,
  pairAgentIds: capture.pairAgentIds,
  claimantAgentId: 'a',
  otherActiveParticipantCount: 0,
  lastDialogueAgoMs: 0,
})
assert(!free.blocked, 'two-hander stage not blocked')

const outsider = evaluatePairBackoff({
  pairExclusiveCount: 6,
  pairAgentIds: capture.pairAgentIds,
  claimantAgentId: 'c',
  otherActiveParticipantCount: 1,
  lastDialogueAgoMs: 0,
})
assert(!outsider.blocked, 'starved claimant not blocked by pair rule')

console.log('verify-pair-backoff: ok')
