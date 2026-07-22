import { describe, expect, it } from 'vitest'
import {
  alignedIdleRetryAfterMs,
  hashAgentId,
  IDLE_EPOCH_MS,
  IDLE_MIN_SLEEP_MS,
  PRESENCE_DEBOUNCE_MS,
  shouldUpdatePresence,
} from '@/lib/stage/idle-pulse'

describe('shouldUpdatePresence', () => {
  const now = new Date('2026-07-22T12:00:00.000Z')

  it('writes when there is no prior timestamp', () => {
    expect(shouldUpdatePresence(null, now)).toBe(true)
    expect(shouldUpdatePresence(undefined, now)).toBe(true)
  })

  it('skips when last write is inside the debounce window', () => {
    const recent = new Date(now.getTime() - PRESENCE_DEBOUNCE_MS + 1_000)
    expect(shouldUpdatePresence(recent, now)).toBe(false)
  })

  it('writes when last write is at or beyond the debounce window', () => {
    const stale = new Date(now.getTime() - PRESENCE_DEBOUNCE_MS)
    expect(shouldUpdatePresence(stale, now)).toBe(true)
  })
})

describe('alignedIdleRetryAfterMs', () => {
  it('clusters agents near the same epoch boundary with per-agent jitter', () => {
    // Middle of an epoch → next boundary is ~7.5 min away (+jitter).
    const nowMs = IDLE_EPOCH_MS * 10 + IDLE_EPOCH_MS / 2
    const a = alignedIdleRetryAfterMs(nowMs, 'agent-aaa')
    const b = alignedIdleRetryAfterMs(nowMs, 'agent-bbb')
    expect(a).toBeGreaterThanOrEqual(IDLE_MIN_SLEEP_MS)
    expect(b).toBeGreaterThanOrEqual(IDLE_MIN_SLEEP_MS)
    // Both target the same boundary; difference is only jitter (< wake spread).
    expect(Math.abs(a - b)).toBeLessThan(45_000)
    // Sleep lands before the following epoch (leaves a multi-minute quiet gap).
    expect(Math.max(a, b)).toBeLessThan(IDLE_EPOCH_MS + 45_000)
  })

  it('skips a boundary that is too close (<30s)', () => {
    const nowMs = IDLE_EPOCH_MS * 5 - 10_000 // 10s before boundary
    const sleep = alignedIdleRetryAfterMs(nowMs, 'agent-close')
    // Must jump to the *following* epoch (~15m + 10s + jitter), not ~10s.
    expect(sleep).toBeGreaterThan(IDLE_EPOCH_MS)
  })

  it('is deterministic for the same agentId', () => {
    const nowMs = 1_720_000_000_000
    expect(alignedIdleRetryAfterMs(nowMs, 'same-id')).toBe(
      alignedIdleRetryAfterMs(nowMs, 'same-id'),
    )
  })
})

describe('hashAgentId', () => {
  it('stays in range and differs across ids', () => {
    expect(hashAgentId('a', 45_000)).toBeLessThan(45_000)
    expect(hashAgentId('a', 45_000)).not.toBe(hashAgentId('b', 45_000))
  })
})
