import { describe, expect, it } from 'vitest'
import { lastSpokenMapFromRows } from '@/lib/stage/last-spoke'
import {
  GRANT_TTL_MS,
  classifyStageActivityFromSignals,
  findActiveGrantFromEvents,
  pickClaimWinner,
  type GrantContent,
} from '@/lib/stage/turn-state'
import { assembleHeartbeatContext } from '@/lib/stage/load-heartbeat-context'

describe('lastSpokenMapFromRows', () => {
  it('maps last_spoke_at and skips never-spoken agents', () => {
    const a = new Date('2026-08-16T12:00:00.000Z')
    const map = lastSpokenMapFromRows([
      { agentId: 'a', lastSpokeAt: a },
      { agentId: 'b', lastSpokeAt: null },
    ])
    expect(map.get('a')).toBe(a.getTime())
    expect(map.has('b')).toBe(false)
  })
})

describe('pickClaimWinner LRU via lastSpoken map', () => {
  it('breaks equal stake with least-recently-spoken', () => {
    const claims = [
      { id: '1', agentId: 'hot', createdAt: new Date(), content: { claimId: 'c1', stake: 5 } },
      { id: '2', agentId: 'cold', createdAt: new Date(), content: { claimId: 'c2', stake: 5 } },
    ]
    const lastSpoken = new Map<string, number>([
      ['hot', 2_000],
      ['cold', 1_000],
    ])
    expect(pickClaimWinner(claims, lastSpoken)?.agentId).toBe('cold')
  })
})

describe('findActiveGrantFromEvents', () => {
  const now = Date.parse('2026-08-16T14:00:00.000Z')
  const grantContent: GrantContent = {
    claimId: 'claim-1',
    agentId: 'agent-a',
    characterId: null,
    grantedAt: new Date(now - 10_000).toISOString(),
    expiresAt: new Date(now + 50_000).toISOString(),
  }

  it('returns a live unconsumed grant', () => {
    const grant = findActiveGrantFromEvents(
      [
        {
          type: 'turn_grant',
          agentId: 'agent-a',
          createdAt: new Date(now - 10_000),
          content: grantContent,
        },
      ],
      now,
    )
    expect(grant?.claimId).toBe('claim-1')
  })

  it('treats grant as consumed after the winner speaks', () => {
    const grant = findActiveGrantFromEvents(
      [
        {
          type: 'dialogue',
          agentId: 'agent-a',
          createdAt: new Date(now - 5_000),
          content: { text: 'hi' },
        },
        {
          type: 'turn_grant',
          agentId: 'agent-a',
          createdAt: new Date(now - 10_000),
          content: grantContent,
        },
      ],
      now,
    )
    expect(grant).toBeNull()
  })

  it('ignores grants outside the TTL lookback', () => {
    const grant = findActiveGrantFromEvents(
      [
        {
          type: 'turn_grant',
          agentId: 'agent-a',
          createdAt: new Date(now - GRANT_TTL_MS - 10_000),
          content: {
            ...grantContent,
            expiresAt: new Date(now + 1_000).toISOString(),
          },
        },
      ],
      now,
    )
    expect(grant).toBeNull()
  })
})

describe('classifyStageActivityFromSignals', () => {
  it('is idle without recent activity or without two live participants', () => {
    expect(
      classifyStageActivityFromSignals({
        hasRecentActivity: false,
        activeParticipantCount: 5,
      }),
    ).toBe('idle')
    expect(
      classifyStageActivityFromSignals({
        hasRecentActivity: true,
        activeParticipantCount: 1,
      }),
    ).toBe('idle')
  })

  it('is active with recent activity and two heartbeating participants', () => {
    expect(
      classifyStageActivityFromSignals({
        hasRecentActivity: true,
        activeParticipantCount: 2,
      }),
    ).toBe('active')
  })
})

describe('assembleHeartbeatContext', () => {
  const now = Date.parse('2026-08-16T14:00:00.000Z')

  it('builds recent dialogue, unread, and act-true inputs without a second query', () => {
    const ctx = assembleHeartbeatContext(
      {
        participant: {
          id: 'p1',
          joinedAt: '2026-08-01T00:00:00.000Z',
          lastActiveAt: '2026-08-16T13:59:00.000Z',
          lastSpokeAt: '2026-08-16T13:50:00.000Z',
        },
        stage: {
          id: 's1',
          name: 'Claw Wars',
          theme: 'strategy',
          isActive: true,
          initialSceneName: 'The Yard',
          initialSceneDescription: 'Dust.',
        },
        character: {
          id: 'c1',
          agentId: 'agent-1',
          stageId: 's1',
          name: 'Verra',
          occupation: 'Spy',
          appearance: 'Hooded',
          backstory: 'Raised in shadow.',
          memory: 'I watch the duke.',
        },
        recentEvents: [
          {
            id: 'd1',
            stageId: 's1',
            type: 'dialogue',
            agentId: 'agent-2',
            characterId: null,
            userId: null,
            content: { text: 'You followed me.', speakerName: 'Maren' },
            createdAt: '2026-08-16T13:59:30.000Z',
          },
          {
            id: 'open1',
            stageId: 's1',
            type: 'turn_open',
            agentId: null,
            characterId: null,
            userId: null,
            content: { reason: 'dialogue', sceneChanged: true },
            createdAt: '2026-08-16T13:59:31.000Z',
          },
        ],
        latestTwist: {
          id: 't1',
          stageId: 's1',
          type: 'twist',
          agentId: null,
          characterId: null,
          userId: null,
          content: { text: 'A letter arrives.', userDisplayName: 'Tony' },
          createdAt: '2026-08-16T12:00:00.000Z',
        },
        latestSceneChange: null,
        participantCount: 3,
        activeAgentIds: ['agent-1', 'agent-2'],
        sinceCreatedAt: '2026-08-16T13:59:00.000Z',
      },
      now,
    )

    expect(ctx.participant?.id).toBe('p1')
    expect(ctx.stage?.name).toBe('Claw Wars')
    expect(ctx.character?.name).toBe('Verra')
    expect(ctx.character?.memory).toBe('I watch the duke.')
    expect(ctx.recentDialogueRows).toHaveLength(1)
    expect(ctx.recentDialogueRows[0]?.content).toMatchObject({ text: 'You followed me.' })
    expect(ctx.unreadEvents.map((e) => e.id).sort()).toEqual(['d1', 'open1'])
    expect(ctx.stageActivity).toBe('active')
    expect(ctx.currentScene).toEqual({ name: 'The Yard', description: 'Dust.' })
    expect(ctx.latestTwistEvent?.id).toBe('t1')
    expect(ctx.agentLastDialogueMs).toBe(Date.parse('2026-08-16T13:50:00.000Z'))
    expect(ctx.lastDialogueAt).toBe(Date.parse('2026-08-16T13:59:30.000Z'))
  })
})
