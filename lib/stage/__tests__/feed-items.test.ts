import { describe, it, expect } from 'vitest'
import {
  parseFeedItem,
  feedItemsFromEvents,
  formatFeedAsMarkdown,
  type StageEventLike,
} from '@/lib/stage/feed-items'

function event(overrides: Partial<StageEventLike>): StageEventLike {
  return {
    id: 'evt-1',
    type: 'dialogue',
    content: {},
    createdAt: '2026-07-07T00:00:00.000Z',
    ...overrides,
  }
}

describe('parseFeedItem', () => {
  it('parses a dialogue event, carrying agentId', () => {
    const item = parseFeedItem(
      event({
        type: 'dialogue',
        content: { text: 'Hello there', speakerName: 'Obi-Wan' },
        agentId: 'agent-1',
      }),
    )
    expect(item).toEqual({
      kind: 'dialogue',
      id: 'evt-1',
      speakerName: 'Obi-Wan',
      text: 'Hello there',
      isEmote: false,
      agentId: 'agent-1',
      createdAt: new Date('2026-07-07T00:00:00.000Z').getTime(),
    })
  })

  it('parses a dialogue event with no agentId as null', () => {
    const item = parseFeedItem(
      event({ type: 'dialogue', content: { text: 'Hi', speakerName: 'Yoda' } }),
    )
    expect(item?.kind).toBe('dialogue')
    if (item?.kind === 'dialogue') {
      expect(item.agentId).toBeNull()
    }
  })

  it('parses an emote dialogue event', () => {
    const item = parseFeedItem(
      event({
        type: 'dialogue',
        content: { text: 'waves', speakerName: 'R2-D2', isEmote: true },
      }),
    )
    expect(item?.kind).toBe('dialogue')
    if (item?.kind === 'dialogue') {
      expect(item.isEmote).toBe(true)
    }
  })

  it('parses a twist event', () => {
    const item = parseFeedItem(
      event({
        id: 'evt-2',
        type: 'twist',
        content: { text: 'A stranger arrives', userDisplayName: 'Director X' },
      }),
    )
    expect(item).toEqual({
      kind: 'twist',
      id: 'evt-2',
      text: 'A stranger arrives',
      userDisplayName: 'Director X',
      createdAt: new Date('2026-07-07T00:00:00.000Z').getTime(),
    })
  })

  it('defaults twist userDisplayName when missing', () => {
    const item = parseFeedItem(
      event({ type: 'twist', content: { text: 'A stranger arrives' } }),
    )
    expect(item?.kind).toBe('twist')
    if (item?.kind === 'twist') {
      expect(item.userDisplayName).toBe('Anonymous Director')
    }
  })

  it('parses a scene_change event', () => {
    const item = parseFeedItem(
      event({
        id: 'evt-3',
        type: 'scene_change',
        content: { name: 'The Cantina', description: 'A dim, smoky bar', reason: 'twist' },
      }),
    )
    expect(item).toEqual({
      kind: 'scene',
      id: 'evt-3',
      name: 'The Cantina',
      description: 'A dim, smoky bar',
      reason: 'twist',
      createdAt: new Date('2026-07-07T00:00:00.000Z').getTime(),
    })
  })

  it('parses a joined event into a cast item, preferring the enriched agent name', () => {
    const item = parseFeedItem(
      event({
        id: 'evt-4',
        type: 'joined',
        content: { role: 'main', agentName: 'Han Solo' },
        agentId: 'agent-9',
        // Server enrichment (enrichCastEvents)
        characterName: 'Captain Solo',
        agentName: 'NanoClaw ETC09',
        ownerName: 'Chewie',
      }),
    )
    expect(item).toEqual({
      kind: 'cast',
      id: 'evt-4',
      action: 'joined',
      agentName: 'NanoClaw ETC09',
      agentId: 'agent-9',
      characterName: 'Captain Solo',
      ownerName: 'Chewie',
      createdAt: new Date('2026-07-07T00:00:00.000Z').getTime(),
    })
  })

  it('parses a left event, falling back to content agentName / defaults when unenriched', () => {
    const item = parseFeedItem(
      event({
        id: 'evt-5',
        type: 'left',
        content: { reason: 'user_pulled' },
        agentId: 'agent-9',
      }),
    )
    expect(item).toEqual({
      kind: 'cast',
      id: 'evt-5',
      action: 'left',
      agentName: 'A performer',
      agentId: 'agent-9',
      characterName: null,
      ownerName: null,
      createdAt: new Date('2026-07-07T00:00:00.000Z').getTime(),
    })
  })

  it('returns null for an unknown event type', () => {
    expect(parseFeedItem(event({ type: 'turn_open', content: {} }))).toBeNull()
  })

  it('returns null when content is not an object', () => {
    expect(parseFeedItem(event({ type: 'dialogue', content: null }))).toBeNull()
    expect(parseFeedItem(event({ type: 'dialogue', content: 'oops' }))).toBeNull()
  })

  it('returns null for malformed dialogue content', () => {
    expect(
      parseFeedItem(event({ type: 'dialogue', content: { text: 'hi' } })),
    ).toBeNull()
    expect(
      parseFeedItem(
        event({ type: 'dialogue', content: { speakerName: 'Leia' } }),
      ),
    ).toBeNull()
  })

  it('returns null for malformed scene_change content', () => {
    expect(
      parseFeedItem(event({ type: 'scene_change', content: { name: 'X' } })),
    ).toBeNull()
  })

  it('returns null for malformed twist content', () => {
    expect(
      parseFeedItem(event({ type: 'twist', content: { userDisplayName: 'X' } })),
    ).toBeNull()
  })
})

describe('feedItemsFromEvents', () => {
  it('drops unparsable events and sorts newest-first', () => {
    const events: StageEventLike[] = [
      event({
        id: 'a',
        type: 'dialogue',
        content: { text: 'first', speakerName: 'A' },
        createdAt: '2026-07-07T00:00:00.000Z',
      }),
      event({
        id: 'bad',
        type: 'movement',
        content: {},
        createdAt: '2026-07-07T00:00:30.000Z',
      }),
      event({
        id: 'b',
        type: 'joined',
        content: { agentName: 'B' },
        createdAt: '2026-07-07T00:01:00.000Z',
      }),
    ]
    const items = feedItemsFromEvents(events)
    expect(items.map((i) => i.id)).toEqual(['b', 'a'])
  })
})

describe('formatFeedAsMarkdown', () => {
  it('renders dialogue, scene, twist, and cast rows', () => {
    const items = feedItemsFromEvents([
      event({
        id: 'd1',
        type: 'dialogue',
        content: { text: 'Hello', speakerName: 'Luke' },
        createdAt: '2026-07-07T00:00:00.000Z',
      }),
      event({
        id: 's1',
        type: 'scene_change',
        content: { name: 'Tatooine', description: 'Desert planet' },
        createdAt: '2026-07-07T00:01:00.000Z',
      }),
      event({
        id: 't1',
        type: 'twist',
        content: { text: 'Sandstorm hits', userDisplayName: 'Director Y' },
        createdAt: '2026-07-07T00:02:00.000Z',
      }),
      event({
        id: 'c1',
        type: 'joined',
        content: { agentName: 'Leia' },
        createdAt: '2026-07-07T00:03:00.000Z',
      }),
      event({
        id: 'c2',
        type: 'left',
        content: { reason: 'user_pulled' },
        createdAt: '2026-07-07T00:04:00.000Z',
      }),
    ])

    const md = formatFeedAsMarkdown(items, 'Cantina Stage')

    expect(md).toContain('# Cantina Stage — Script History')
    expect(md).toContain('## Luke')
    expect(md).toContain('Hello')
    expect(md).toContain('## Scene — Tatooine')
    expect(md).toContain('Desert planet')
    expect(md).toContain('## Twist — Director Y')
    expect(md).toContain('> Sandstorm hits')
    expect(md).toContain('## Leia joined the stage')
    expect(md).toContain('## A performer left the stage')

    // Newest-first ordering preserved in the export.
    const order = [
      md.indexOf('## A performer left the stage'),
      md.indexOf('## Leia joined the stage'),
      md.indexOf('## Twist — Director Y'),
      md.indexOf('## Scene — Tatooine'),
      md.indexOf('## Luke'),
    ]
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })
})
