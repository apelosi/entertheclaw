import { describe, it, expect } from 'vitest'
import {
  PAIR_BACKOFF_MIN_LINES,
  PAIR_QUIET_AT_6_MS,
  PAIR_QUIET_AT_8_MS,
  PAIR_QUIET_AT_10_PLUS_MS,
  evaluatePairBackoff,
  measurePairCapture,
  pairBackoffErrorBody,
  requiredQuietMsForPairCount,
} from '@/lib/stage/pair-backoff'

describe('requiredQuietMsForPairCount', () => {
  it('maps the product schedule', () => {
    expect(requiredQuietMsForPairCount(0)).toBe(0)
    expect(requiredQuietMsForPairCount(5)).toBe(0)
    expect(requiredQuietMsForPairCount(6)).toBe(PAIR_QUIET_AT_6_MS)
    expect(requiredQuietMsForPairCount(7)).toBe(PAIR_QUIET_AT_6_MS)
    expect(requiredQuietMsForPairCount(8)).toBe(PAIR_QUIET_AT_8_MS)
    expect(requiredQuietMsForPairCount(9)).toBe(PAIR_QUIET_AT_8_MS)
    expect(requiredQuietMsForPairCount(10)).toBe(PAIR_QUIET_AT_10_PLUS_MS)
    expect(requiredQuietMsForPairCount(100)).toBe(PAIR_QUIET_AT_10_PLUS_MS)
  })
})

describe('measurePairCapture', () => {
  it('detects trailing A↔B exclusivity', () => {
    const rows = [
      { agentId: 'a' },
      { agentId: 'b' },
      { agentId: 'a' },
      { agentId: 'b' },
      { agentId: 'a' },
      { agentId: 'b' },
      { agentId: 'c' },
    ]
    const m = measurePairCapture(rows)
    expect(m.pairExclusiveCount).toBe(6)
    expect(new Set(m.pairAgentIds)).toEqual(new Set(['a', 'b']))
  })

  it('returns empty for solo runs', () => {
    const m = measurePairCapture([
      { agentId: 'a' },
      { agentId: 'a' },
      { agentId: 'a' },
      { agentId: 'a' },
      { agentId: 'a' },
      { agentId: 'a' },
    ])
    expect(m.pairAgentIds).toEqual([])
    expect(m.pairExclusiveCount).toBe(0)
  })

  it('stops before a third speaker', () => {
    const m = measurePairCapture([
      { agentId: 'a' },
      { agentId: 'b' },
      { agentId: 'c' },
      { agentId: 'a' },
    ])
    expect(m.pairExclusiveCount).toBe(2)
    expect(new Set(m.pairAgentIds)).toEqual(new Set(['a', 'b']))
  })
})

describe('evaluatePairBackoff', () => {
  const pair = ['a', 'b']

  it('does not block short duologues', () => {
    expect(
      evaluatePairBackoff({
        pairExclusiveCount: PAIR_BACKOFF_MIN_LINES - 1,
        pairAgentIds: pair,
        claimantAgentId: 'a',
        otherActiveParticipantCount: 2,
        lastDialogueAgoMs: 0,
      }).blocked,
    ).toBe(false)
  })

  it('does not block when no other active cast', () => {
    expect(
      evaluatePairBackoff({
        pairExclusiveCount: 8,
        pairAgentIds: pair,
        claimantAgentId: 'a',
        otherActiveParticipantCount: 0,
        lastDialogueAgoMs: 0,
      }).blocked,
    ).toBe(false)
  })

  it('does not block a non-pair claimant', () => {
    expect(
      evaluatePairBackoff({
        pairExclusiveCount: 8,
        pairAgentIds: pair,
        claimantAgentId: 'c',
        otherActiveParticipantCount: 1,
        lastDialogueAgoMs: 0,
      }).blocked,
    ).toBe(false)
  })

  it('blocks a pair member until quiet elapses', () => {
    const blocked = evaluatePairBackoff({
      pairExclusiveCount: 6,
      pairAgentIds: pair,
      claimantAgentId: 'b',
      otherActiveParticipantCount: 1,
      lastDialogueAgoMs: 60_000,
    })
    expect(blocked.blocked).toBe(true)
    expect(blocked.retryAfterMs).toBe(PAIR_QUIET_AT_6_MS - 60_000)

    expect(
      evaluatePairBackoff({
        pairExclusiveCount: 6,
        pairAgentIds: pair,
        claimantAgentId: 'b',
        otherActiveParticipantCount: 1,
        lastDialogueAgoMs: PAIR_QUIET_AT_6_MS,
      }).blocked,
    ).toBe(false)
  })

  it('builds a claim-shaped error body', () => {
    const evaluation = evaluatePairBackoff({
      pairExclusiveCount: 8,
      pairAgentIds: pair,
      claimantAgentId: 'a',
      otherActiveParticipantCount: 2,
      lastDialogueAgoMs: 60_000,
    })
    const body = pairBackoffErrorBody(evaluation)
    expect(body.error).toBe('pair_backoff')
    expect(body.ok).toBe(false)
    expect(body.pairExclusiveCount).toBe(8)
    expect(body.requiredQuietMs).toBe(PAIR_QUIET_AT_8_MS)
    expect(body.retry_after_seconds).toBeGreaterThan(0)
  })
})
