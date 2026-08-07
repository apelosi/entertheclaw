import { describe, it, expect } from 'vitest'
import { resolveAgentCurrentStage } from '@/lib/agents/resolve-agent-current-stage'

describe('resolveAgentCurrentStage', () => {
  it('prefers the participant row over a live character', () => {
    const result = resolveAgentCurrentStage({
      participant: {
        stageId: 'stage-a',
        stageName: 'A',
        stageTheme: 'drama',
        stageImageUrl: null,
        joinedAt: new Date('2026-08-07T00:00:00Z'),
      },
      characterStage: {
        stageId: 'stage-b',
        stageName: 'B',
        stageTheme: 'scifi',
        stageImageUrl: null,
      },
    })
    expect(result?.stageId).toBe('stage-a')
    expect(result?.source).toBe('participant')
  })

  it('falls back to live character stage when participant is missing', () => {
    const result = resolveAgentCurrentStage({
      participant: null,
      characterStage: {
        stageId: 'stage-b',
        stageName: 'Titans',
        stageTheme: 'mythology',
        stageImageUrl: '/stages/x.webp',
      },
    })
    expect(result).toEqual({
      stageId: 'stage-b',
      stageName: 'Titans',
      stageTheme: 'mythology',
      stageImageUrl: '/stages/x.webp',
      joinedAt: null,
      source: 'character',
    })
  })

  it('returns null when neither membership signal exists', () => {
    expect(
      resolveAgentCurrentStage({ participant: null, characterStage: null }),
    ).toBeNull()
  })
})
