import { describe, it, expect } from 'vitest'
import {
  parseEventTypesParam,
  parseEventsLimit,
  parseFeedEventTypesParam,
  parseFeedLimit,
} from '@/lib/stage/query-stage-events'

describe('parseEventTypesParam (agent-facing /events allowlist, unchanged)', () => {
  it('returns null for empty/missing input', () => {
    expect(parseEventTypesParam(null)).toBeNull()
    expect(parseEventTypesParam('')).toBeNull()
    expect(parseEventTypesParam('   ')).toBeNull()
  })

  it('parses a valid csv list', () => {
    expect(parseEventTypesParam('dialogue,twist')).toEqual(['dialogue', 'twist'])
  })

  it('rejects joined/left — not part of the agent-facing allowlist', () => {
    expect(parseEventTypesParam('joined')).toBeNull()
    expect(parseEventTypesParam('dialogue,left')).toBeNull()
  })

  it('rejects any unknown type', () => {
    expect(parseEventTypesParam('dialogue,bogus')).toBeNull()
  })
})

describe('parseEventsLimit (agent-facing, unchanged)', () => {
  it('defaults to 50 when missing or invalid', () => {
    expect(parseEventsLimit(null)).toBe(50)
    expect(parseEventsLimit('not-a-number')).toBe(50)
    expect(parseEventsLimit('0')).toBe(50)
    expect(parseEventsLimit('-5')).toBe(50)
  })

  it('clamps to the 200 max', () => {
    expect(parseEventsLimit('9999')).toBe(200)
  })

  it('passes through valid values under the max', () => {
    expect(parseEventsLimit('10')).toBe(10)
  })
})

describe('parseFeedEventTypesParam (feed endpoint allowlist)', () => {
  it('returns null for empty/missing input', () => {
    expect(parseFeedEventTypesParam(null)).toBeNull()
    expect(parseFeedEventTypesParam('')).toBeNull()
  })

  it('accepts joined and left in addition to the original three types', () => {
    expect(parseFeedEventTypesParam('joined,left')).toEqual(['joined', 'left'])
    expect(parseFeedEventTypesParam('dialogue,scene_change,twist,joined,left')).toEqual([
      'dialogue',
      'scene_change',
      'twist',
      'joined',
      'left',
    ])
  })

  it('rejects unknown types', () => {
    expect(parseFeedEventTypesParam('dialogue,turn_open')).toBeNull()
  })

  it('trims whitespace around csv entries', () => {
    expect(parseFeedEventTypesParam(' dialogue , twist ')).toEqual(['dialogue', 'twist'])
  })
})

describe('parseFeedLimit', () => {
  it('defaults to 20 when missing or invalid', () => {
    expect(parseFeedLimit(null)).toBe(20)
    expect(parseFeedLimit('not-a-number')).toBe(20)
    expect(parseFeedLimit('0')).toBe(20)
    expect(parseFeedLimit('-1')).toBe(20)
  })

  it('clamps to the 100 max', () => {
    expect(parseFeedLimit('500')).toBe(100)
  })

  it('passes through valid values under the max', () => {
    expect(parseFeedLimit('35')).toBe(35)
  })
})
