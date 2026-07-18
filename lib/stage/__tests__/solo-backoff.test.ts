import { describe, it, expect } from 'vitest'
import {
  QUIET_INITIATIVE_MS,
  SOLO_QUIET_AT_2_MS,
  SOLO_QUIET_AT_3_MS,
  SOLO_QUIET_AT_4_MS,
  SOLO_QUIET_AT_5_MS,
  SOLO_QUIET_AT_6_PLUS_MS,
  countConsecutiveSoloDialogue,
  evaluateSoloBackoff,
  requiredQuietMsForSoloCount,
  soloBackoffErrorBody,
} from '@/lib/stage/solo-backoff'

describe('requiredQuietMsForSoloCount', () => {
  it('maps the product schedule', () => {
    expect(requiredQuietMsForSoloCount(0)).toBe(QUIET_INITIATIVE_MS)
    expect(requiredQuietMsForSoloCount(1)).toBe(QUIET_INITIATIVE_MS)
    expect(requiredQuietMsForSoloCount(2)).toBe(SOLO_QUIET_AT_2_MS)
    expect(requiredQuietMsForSoloCount(3)).toBe(SOLO_QUIET_AT_3_MS)
    expect(requiredQuietMsForSoloCount(4)).toBe(SOLO_QUIET_AT_4_MS)
    expect(requiredQuietMsForSoloCount(5)).toBe(SOLO_QUIET_AT_5_MS)
    expect(requiredQuietMsForSoloCount(6)).toBe(SOLO_QUIET_AT_6_PLUS_MS)
    expect(requiredQuietMsForSoloCount(100)).toBe(SOLO_QUIET_AT_6_PLUS_MS)
  })
})

describe('countConsecutiveSoloDialogue', () => {
  it('counts trailing own lines newest-first', () => {
    expect(
      countConsecutiveSoloDialogue(
        [
          { agentId: 'a' },
          { agentId: 'a' },
          { agentId: 'b' },
          { agentId: 'a' },
        ],
        'a',
      ),
    ).toBe(2)
  })

  it('returns 0 when someone else spoke last', () => {
    expect(
      countConsecutiveSoloDialogue([{ agentId: 'b' }, { agentId: 'a' }], 'a'),
    ).toBe(0)
  })
})

describe('evaluateSoloBackoff', () => {
  it('never blocks when count is 0 (reactions allowed)', () => {
    expect(
      evaluateSoloBackoff({
        consecutiveSoloDialogueCount: 0,
        lastDialogueAgoMs: 0,
      }).blocked,
    ).toBe(false)
  })

  it('blocks count=1 until 2 minutes quiet', () => {
    expect(
      evaluateSoloBackoff({
        consecutiveSoloDialogueCount: 1,
        lastDialogueAgoMs: QUIET_INITIATIVE_MS - 1,
      }).blocked,
    ).toBe(true)
    expect(
      evaluateSoloBackoff({
        consecutiveSoloDialogueCount: 1,
        lastDialogueAgoMs: QUIET_INITIATIVE_MS,
      }).blocked,
    ).toBe(false)
  })

  it('blocks count=2 until 8 minutes quiet', () => {
    const blocked = evaluateSoloBackoff({
      consecutiveSoloDialogueCount: 2,
      lastDialogueAgoMs: QUIET_INITIATIVE_MS,
    })
    expect(blocked.blocked).toBe(true)
    expect(blocked.retryAfterMs).toBe(SOLO_QUIET_AT_2_MS - QUIET_INITIATIVE_MS)

    expect(
      evaluateSoloBackoff({
        consecutiveSoloDialogueCount: 2,
        lastDialogueAgoMs: SOLO_QUIET_AT_2_MS,
      }).blocked,
    ).toBe(false)
  })

  it('builds a claim-shaped error body', () => {
    const evaluation = evaluateSoloBackoff({
      consecutiveSoloDialogueCount: 3,
      lastDialogueAgoMs: 60_000,
    })
    const body = soloBackoffErrorBody(evaluation)
    expect(body.error).toBe('solo_backoff')
    expect(body.ok).toBe(false)
    expect(body.consecutiveSoloDialogueCount).toBe(3)
    expect(body.requiredQuietMs).toBe(SOLO_QUIET_AT_3_MS)
    expect(body.retry_after_seconds).toBeGreaterThan(0)
  })
})
