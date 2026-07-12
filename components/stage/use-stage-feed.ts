'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  feedReducer,
  initialFeedState,
  visibleUnderFilter,
  type FeedFilter,
} from '@/lib/stage/feed-state'
import { parseFeedItem, type FeedItem, type StageEventLike } from '@/lib/stage/feed-items'

const PRELOAD_PAGE_SIZE = 100
const OLDER_PAGE_SIZE = 100
/** scrollTop under this (px from the newest end) counts as "following" the live edge. */
const FOLLOW_THRESHOLD_PX = 24

interface FeedApiEvent extends StageEventLike {
  agentId?: string | null
  isOwn?: boolean
}

/**
 * How much of the timeline to pull up front:
 * - 'none' — just the total (the caller already has the items).
 * - 'all'  — background-load the entire history, newest → older.
 * With 'all', filtering is a pure client-side subset (no per-filter fetch), so
 * switching filters is instant and complete — this is why the panel's Twists
 * filter finds twists that are older than the recent window. It's a one-time
 * load on entry, dwarfed by the ongoing SSE poll.
 */
type PreloadMode = 'none' | 'all'

interface UseStageFeedOptions {
  stageId: string
  /** Recent items already loaded by the server (newest-first). */
  initialItems: FeedItem[]
  /** Starting filter (the history route derives it from the URL). */
  initialFilter?: FeedFilter
  /** Called after the user changes the filter (the history route syncs the URL). */
  onFilterChange?: (filter: FeedFilter) => void
  preload?: PreloadMode
}

export interface StageFeedController {
  filter: FeedFilter
  setFilter: (filter: FeedFilter) => void
  visibleItems: FeedItem[]
  allItems: FeedItem[]
  hasMore: boolean
  total: number | null
  /** No items yet and still fetching the first page — show a skeleton, not empty. */
  loading: boolean
  /** Background preload still running — a currently-empty filter may still fill. */
  preloading: boolean
  loadingOlder: boolean
  following: boolean
  unread: number
  pushLive: (item: FeedItem) => void
  loadOlder: () => void
  jumpToLatest: () => void
  scrollRef: React.RefObject<HTMLDivElement | null>
  sentinelRef: React.RefObject<HTMLDivElement | null>
  onScroll: () => void
}

function parseEvents(events: unknown): FeedItem[] {
  if (!Array.isArray(events)) return []
  return (events as FeedApiEvent[])
    .map((e) => parseFeedItem(e))
    .filter((i): i is FeedItem => i !== null)
}

/**
 * Owns the unified stage feed's timeline: the loaded items, the active filter,
 * and follow/unread tracking. All event types are loaded up front (per
 * `preload`) so filtering is an instant client-side subset. StageCanvas pushes
 * live SSE items in via `pushLive`; the newest end is the top of the list.
 */
export function useStageFeed({
  stageId,
  initialItems,
  initialFilter = 'all',
  onFilterChange,
  preload = 'none',
}: UseStageFeedOptions): StageFeedController {
  const [state, dispatch] = useReducer(feedReducer, undefined, () => ({
    ...initialFeedState,
    items: initialItems,
    filter: initialFilter,
  }))
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [preloading, setPreloading] = useState(preload !== 'none')

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadingRef = useRef(false)
  const preloadingRef = useRef(false)

  const visibleItems = useMemo(
    () => visibleUnderFilter(state.items, state.filter),
    [state.items, state.filter],
  )

  const hasMore =
    !state.reachedEnd && (state.total === null || state.items.length < state.total)
  const loading = state.items.length === 0 && preloading

  // Load the timeline up front (all event types), newest → older. Filtering is
  // client-side afterward, so this is the only place data is fetched on entry.
  useEffect(() => {
    const controller = new AbortController()

    async function run() {
      if (preload === 'none') {
        // The caller already has the items; we only need the total.
        try {
          const r = await fetch(`/api/v1/stages/${stageId}/feed?limit=1`, {
            signal: controller.signal,
          })
          const data = r.ok ? await r.json() : null
          if (data && typeof data.total === 'number') {
            dispatch({ kind: 'hydrate', items: parseEvents(data.events), total: data.total })
          }
        } catch {
          /* aborted/offline — feed still works off initialItems + live SSE */
        }
        return
      }

      preloadingRef.current = true
      setPreloading(true)
      let cursor: string | null = null
      let first = true

      while (!controller.signal.aborted) {
        const params = new URLSearchParams({ limit: String(PRELOAD_PAGE_SIZE) })
        if (cursor) params.set('before', cursor)
        let data: { events?: unknown; total?: number; hasMore?: boolean } | null = null
        try {
          const r = await fetch(`/api/v1/stages/${stageId}/feed?${params.toString()}`, {
            signal: controller.signal,
          })
          data = r.ok ? await r.json() : null
        } catch {
          break
        }
        if (!data) break

        const items = parseEvents(data.events)
        if (first) {
          dispatch({ kind: 'hydrate', items, total: data.total ?? null })
        } else {
          dispatch({ kind: 'olderLoaded', items })
        }
        first = false
        cursor = items.length ? items[items.length - 1].id : cursor
        if (!data.hasMore || items.length === 0) break
      }

      if (!controller.signal.aborted) {
        preloadingRef.current = false
        setPreloading(false)
      }
    }

    run()
    return () => {
      controller.abort()
      preloadingRef.current = false
    }
    // Preload runs once per stage on mount; initialFilter/initialItems are seeds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageId, preload])

  const loadOlder = useCallback(() => {
    if (loadingRef.current || preloadingRef.current || state.reachedEnd) return
    const oldest = state.items[state.items.length - 1]
    if (!oldest) return

    loadingRef.current = true
    setLoadingOlder(true)

    // Fetch all types — filtering is client-side over the full timeline.
    const params = new URLSearchParams({ before: oldest.id, limit: String(OLDER_PAGE_SIZE) })
    fetch(`/api/v1/stages/${stageId}/feed?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.events)) return
        dispatch({ kind: 'olderLoaded', items: parseEvents(data.events) })
      })
      .catch(() => {})
      .finally(() => {
        loadingRef.current = false
        setLoadingOlder(false)
      })
  }, [stageId, state.items, state.reachedEnd])

  const pushLive = useCallback((item: FeedItem) => {
    dispatch({ kind: 'live', item })
  }, [])

  const setFilter = useCallback(
    (filter: FeedFilter) => {
      dispatch({ kind: 'setFilter', filter })
      onFilterChange?.(filter)
    },
    [onFilterChange],
  )

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const following = el.scrollTop <= FOLLOW_THRESHOLD_PX
    dispatch({ kind: 'setFollowing', following })
  }, [])

  const jumpToLatest = useCallback(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' })
    dispatch({ kind: 'setFollowing', following: true })
  }, [])

  // Load older pages when the bottom sentinel scrolls into view (only relevant
  // once preloading has stopped and there's still more beyond the cap).
  useEffect(() => {
    const sentinel = sentinelRef.current
    const root = scrollRef.current
    if (!sentinel || !root) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadOlder()
      },
      { root, rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadOlder])

  return {
    filter: state.filter,
    setFilter,
    visibleItems,
    allItems: state.items,
    hasMore,
    total: state.total,
    loading,
    preloading,
    loadingOlder,
    following: state.following,
    unread: state.unread,
    pushLive,
    loadOlder,
    jumpToLatest,
    scrollRef,
    sentinelRef,
    onScroll,
  }
}
