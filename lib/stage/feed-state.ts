import type { FeedItem } from './feed-items'

/**
 * Pure state for the unified stage feed. The React hook (use-stage-feed) owns
 * scroll/DOM concerns and dispatches these actions; everything here is a pure
 * function so it can be unit-tested without a DOM or a database.
 */

export type FeedFilter = 'all' | 'dialogue' | 'scene' | 'twist' | 'cast' | 'mine'

export const FEED_FILTERS: { id: FeedFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'dialogue', label: 'Lines' },
  { id: 'scene', label: 'Scenes' },
  { id: 'twist', label: 'Twists' },
  { id: 'cast', label: 'Cast' },
  { id: 'mine', label: 'Mine' },
]

export interface FeedState {
  /** All loaded items, newest-first, deduped by id. */
  items: FeedItem[]
  /** Total events on the server for the feed type set (null until known). */
  total: number | null
  /** An older page came back with nothing new — the oldest end is reached. */
  reachedEnd: boolean
  filter: FeedFilter
  /** View is pinned to the newest end (top). */
  following: boolean
  /** Completed items that arrived while not following. */
  unread: number
}

export type FeedAction =
  | { kind: 'hydrate'; items: FeedItem[]; total: number | null }
  | { kind: 'olderLoaded'; items: FeedItem[] }
  | { kind: 'live'; item: FeedItem }
  | { kind: 'setFilter'; filter: FeedFilter }
  | { kind: 'setFollowing'; following: boolean }

export const initialFeedState: FeedState = {
  items: [],
  total: null,
  reachedEnd: false,
  filter: 'all',
  following: true,
  unread: 0,
}

/** Merge two newest-first lists, dedupe by id (first occurrence wins), keep newest-first. */
export function mergeFeedItems(a: FeedItem[], b: FeedItem[]): FeedItem[] {
  const seen = new Set<string>()
  const out: FeedItem[] = []
  for (const item of [...a, ...b]) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  out.sort((x, y) => y.createdAt - x.createdAt)
  return out
}

/** The server type set a given filter maps to; null means "all types". */
export function filterToTypes(filter: FeedFilter): string[] | null {
  switch (filter) {
    case 'dialogue':
      return ['dialogue']
    case 'scene':
      return ['scene_change']
    case 'twist':
      return ['twist']
    case 'cast':
      return ['joined', 'left']
    case 'all':
    case 'mine':
    default:
      return null
  }
}

/** Items visible under a filter (client-side view over an already-loaded list). */
export function visibleUnderFilter(items: FeedItem[], filter: FeedFilter): FeedItem[] {
  switch (filter) {
    case 'dialogue':
      return items.filter((i) => i.kind === 'dialogue')
    case 'scene':
      return items.filter((i) => i.kind === 'scene')
    case 'twist':
      return items.filter((i) => i.kind === 'twist')
    case 'cast':
      return items.filter((i) => i.kind === 'cast')
    case 'mine':
      return items.filter(
        (i) => (i.kind === 'dialogue' || i.kind === 'twist') && i.isOwn === true,
      )
    case 'all':
    default:
      return items
  }
}

/** Items visible under the active filter (client-side view over loaded items). */
export function selectVisibleItems(state: FeedState): FeedItem[] {
  return visibleUnderFilter(state.items, state.filter)
}

export function feedReducer(state: FeedState, action: FeedAction): FeedState {
  switch (action.kind) {
    case 'hydrate':
      return {
        ...state,
        items: mergeFeedItems(state.items, action.items),
        total: action.total,
      }
    case 'olderLoaded': {
      const items = mergeFeedItems(state.items, action.items)
      // Nothing new came back — we've reached the oldest event.
      return { ...state, items, reachedEnd: items.length === state.items.length }
    }
    case 'live': {
      if (state.items.some((i) => i.id === action.item.id)) return state
      const items = mergeFeedItems([action.item], state.items)
      return {
        ...state,
        items,
        // Keep the known total consistent as live items append.
        total: state.total === null ? null : state.total + 1,
        unread: state.following ? 0 : state.unread + 1,
      }
    }
    case 'setFilter':
      return { ...state, filter: action.filter }
    case 'setFollowing':
      return {
        ...state,
        following: action.following,
        unread: action.following ? 0 : state.unread,
      }
    default:
      return state
  }
}
