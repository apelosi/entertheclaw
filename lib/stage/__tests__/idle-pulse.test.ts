import { describe, expect, it } from 'vitest'
import { PRESENCE_DEBOUNCE_MS, shouldUpdatePresence } from '@/lib/stage/idle-pulse'

describe('shouldUpdatePresence', () => {
  const now = new Date('2026-08-16T14:00:00.000Z')

  it('writes when there is no prior timestamp', () => {
    expect(shouldUpdatePresence(null, now)).toBe(true)
    expect(shouldUpdatePresence(undefined, now)).toBe(true)
  })

  it('skips when last write is inside the debounce window', () => {
    const recent = new Date(now.getTime() - PRESENCE_DEBOUNCE_MS + 1_000)
    expect(shouldUpdatePresence(recent, now)).toBe(false)
  })

  it('writes when last write is at or beyond the debounce window', () => {
    const aged = new Date(now.getTime() - PRESENCE_DEBOUNCE_MS)
    expect(shouldUpdatePresence(aged, now)).toBe(true)
  })

  it('writes on invalid timestamps', () => {
    expect(shouldUpdatePresence('not-a-date', now)).toBe(true)
  })
})
