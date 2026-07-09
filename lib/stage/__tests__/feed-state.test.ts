import { describe, it, expect } from 'vitest'
import {
  feedReducer,
  initialFeedState,
  mergeFeedItems,
  visibleUnderFilter,
  filterToTypes,
  type FeedState,
} from '@/lib/stage/feed-state'
import type { FeedItem } from '@/lib/stage/feed-items'

const dialogue = (id: string, t: number, isOwn = false): FeedItem => ({
  kind: 'dialogue',
  id,
  speakerName: 'X',
  text: 'hi',
  agentId: 'a',
  createdAt: t,
  ...(isOwn ? { isOwn: true } : {}),
})
const twist = (id: string, t: number, isOwn = false): FeedItem => ({
  kind: 'twist',
  id,
  text: 'twist',
  userDisplayName: 'D',
  createdAt: t,
  ...(isOwn ? { isOwn: true } : {}),
})
const scene = (id: string, t: number): FeedItem => ({
  kind: 'scene',
  id,
  name: 'S',
  description: 'd',
  createdAt: t,
})
const cast = (id: string, t: number): FeedItem => ({
  kind: 'cast',
  id,
  action: 'joined',
  agentName: 'A',
  createdAt: t,
})

describe('mergeFeedItems', () => {
  it('dedupes by id and sorts newest-first', () => {
    const merged = mergeFeedItems([dialogue('a', 3)], [dialogue('b', 5), dialogue('a', 3)])
    expect(merged.map((i) => i.id)).toEqual(['b', 'a'])
  })

  it('keeps the first occurrence when ids collide', () => {
    const first = { ...dialogue('a', 3), text: 'first' }
    const second = { ...dialogue('a', 3), text: 'second' }
    const merged = mergeFeedItems([first], [second])
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ text: 'first' })
  })
})

describe('filterToTypes', () => {
  it('maps filters to server type sets, null for all/mine', () => {
    expect(filterToTypes('all')).toBeNull()
    expect(filterToTypes('mine')).toBeNull()
    expect(filterToTypes('dialogue')).toEqual(['dialogue'])
    expect(filterToTypes('scene')).toEqual(['scene_change'])
    expect(filterToTypes('cast')).toEqual(['joined', 'left'])
  })
})

describe('visibleUnderFilter', () => {
  const items = [dialogue('d', 4, true), twist('t', 3), scene('s', 2), cast('c', 1)]

  it('returns everything for all', () => {
    expect(visibleUnderFilter(items, 'all')).toHaveLength(4)
  })
  it('filters by kind', () => {
    expect(visibleUnderFilter(items, 'dialogue').map((i) => i.id)).toEqual(['d'])
    expect(visibleUnderFilter(items, 'scene').map((i) => i.id)).toEqual(['s'])
    expect(visibleUnderFilter(items, 'cast').map((i) => i.id)).toEqual(['c'])
  })
  it('mine returns only own dialogue/twist', () => {
    const mixed = [dialogue('d1', 5, true), dialogue('d2', 4, false), twist('t1', 3, true)]
    expect(visibleUnderFilter(mixed, 'mine').map((i) => i.id)).toEqual(['d1', 't1'])
  })
})

describe('feedReducer', () => {
  const base: FeedState = { ...initialFeedState, items: [dialogue('a', 5)] }

  it('hydrate merges items and sets total', () => {
    const next = feedReducer(base, { kind: 'hydrate', items: [dialogue('b', 6)], total: 42 })
    expect(next.items.map((i) => i.id)).toEqual(['b', 'a'])
    expect(next.total).toBe(42)
  })

  it('olderLoaded appends older items (deduped, sorted)', () => {
    const next = feedReducer(base, { kind: 'olderLoaded', items: [dialogue('z', 1), dialogue('a', 5)] })
    expect(next.items.map((i) => i.id)).toEqual(['a', 'z'])
    expect(next.reachedEnd).toBe(false)
  })

  it('olderLoaded with nothing new marks reachedEnd', () => {
    expect(feedReducer(base, { kind: 'olderLoaded', items: [] }).reachedEnd).toBe(true)
    // A page that only repeats already-loaded ids also counts as the end.
    expect(
      feedReducer(base, { kind: 'olderLoaded', items: [dialogue('a', 5)] }).reachedEnd,
    ).toBe(true)
  })

  it('live prepends, increments unread when not following, bumps total', () => {
    const state: FeedState = { ...base, following: false, unread: 2, total: 10 }
    const next = feedReducer(state, { kind: 'live', item: dialogue('new', 9) })
    expect(next.items[0]!.id).toBe('new')
    expect(next.unread).toBe(3)
    expect(next.total).toBe(11)
  })

  it('live keeps unread at 0 while following', () => {
    const state: FeedState = { ...base, following: true, unread: 0, total: null }
    const next = feedReducer(state, { kind: 'live', item: dialogue('new', 9) })
    expect(next.unread).toBe(0)
    expect(next.total).toBeNull()
  })

  it('live ignores a duplicate id', () => {
    const state: FeedState = { ...base, following: false, unread: 1 }
    const next = feedReducer(state, { kind: 'live', item: dialogue('a', 5) })
    expect(next).toBe(state)
  })

  it('setFollowing(true) clears unread; setFilter changes filter', () => {
    const state: FeedState = { ...base, following: false, unread: 4 }
    expect(feedReducer(state, { kind: 'setFollowing', following: true }).unread).toBe(0)
    expect(feedReducer(state, { kind: 'setFollowing', following: false }).unread).toBe(4)
    expect(feedReducer(state, { kind: 'setFilter', filter: 'twist' }).filter).toBe('twist')
  })
})
