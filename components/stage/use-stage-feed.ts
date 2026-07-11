'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  feedReducer,
  filterToTypes,
  initialFeedState,
  visibleUnderFilter,
  type FeedFilter,
} from '@/lib/stage/feed-state'
import { parseFeedItem, type FeedItem, type StageEventLike } from '@/lib/stage/feed-items'

const OLDER_PAGE_SIZE = 20
/** scrollTop under this (px from the newest end) counts as "following" the live edge. */
const FOLLOW_THRESHOLD_PX = 24

interface FeedApiEvent extends StageEventLike {
  agentId?: string | null
  isOwn?: boolean
}

interface UseStageFeedOptions {
  stageId: string
  /** Recent items already loaded by the server (newest-first). */
  initialItems: FeedItem[]
}

export interface StageFeedController {
  filter: FeedFilter
  setFilter: (filter: FeedFilter) => void
  visibleItems: FeedItem[]
  allItems: FeedItem[]
  hasMore: boolean
  total: number | null
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

/**
 * Owns the unified stage feed's timeline: the loaded items, older-page
 * pagination against /feed, the active filter, and follow/unread tracking.
 * StageCanvas pushes live SSE items in via `pushLive`; the newest end is the
 * top of the list (matching the app's newest-first convention).
 */
export function useStageFeed({ stageId, initialItems }: UseStageFeedOptions): StageFeedController {
  const [state, dispatch] = useReducer(feedReducer, undefined, () => ({
    ...initialFeedState,
    items: initialItems,
  }))
  const [loadingOlder, setLoadingOlder] = useState(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadingRef = useRef(false)

  const visibleItems = useMemo(
    () => visibleUnderFilter(state.items, state.filter),
    [state.items, state.filter],
  )

  const hasMore =
    !state.reachedEnd && (state.total === null || state.items.length < state.total)

  // One tiny fetch on mount to learn the true total (powers "N of M"); the
  // items are already painted from the server-provided initialItems.
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/v1/stages/${stageId}/feed?limit=1`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || typeof data.total !== 'number') return
        const parsed = Array.isArray(data.events)
          ? (data.events as FeedApiEvent[])
              .map((e) => parseFeedItem(e))
              .filter((i): i is FeedItem => i !== null)
          : []
        dispatch({ kind: 'hydrate', items: parsed, total: data.total })
      })
      .catch(() => {
        // aborted or offline; the feed still works off initialItems + live SSE
      })
    return () => controller.abort()
  }, [stageId])

  const loadOlder = useCallback(() => {
    if (loadingRef.current || state.reachedEnd) return
    const oldest = state.items[state.items.length - 1]
    if (!oldest) return

    loadingRef.current = true
    setLoadingOlder(true)

    const types = filterToTypes(state.filter)
    const params = new URLSearchParams({
      before: oldest.id,
      limit: String(OLDER_PAGE_SIZE),
    })
    if (types) params.set('types', types.join(','))

    fetch(`/api/v1/stages/${stageId}/feed?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.events)) return
        const items = (data.events as FeedApiEvent[])
          .map((e) => parseFeedItem(e))
          .filter((i): i is FeedItem => i !== null)
        dispatch({ kind: 'olderLoaded', items })
      })
      .catch(() => {})
      .finally(() => {
        loadingRef.current = false
        setLoadingOlder(false)
      })
  }, [stageId, state.filter, state.items, state.reachedEnd])

  const pushLive = useCallback((item: FeedItem) => {
    dispatch({ kind: 'live', item })
  }, [])

  const setFilter = useCallback((filter: FeedFilter) => {
    dispatch({ kind: 'setFilter', filter })
  }, [])

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

  // Load older pages when the bottom sentinel scrolls into view.
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
