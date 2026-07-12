'use client'

import { useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CopyButton } from '@/components/ui/copy-button'
import { formatFeedAsMarkdown } from '@/lib/stage/feed-items'
import { FEED_FILTERS, type FeedFilter } from '@/lib/stage/feed-state'
import { cn } from '@/lib/utils'
import { IndicatorLegend } from './cast-card'
import { StageFeed } from './stage-feed'
import { useStageFeed } from './use-stage-feed'

const VALID_FILTERS: FeedFilter[] = ['all', 'dialogue', 'scene', 'twist', 'cast', 'mine']

function filterFromParam(value: string | null): FeedFilter {
  return value && (VALID_FILTERS as string[]).includes(value)
    ? (value as FeedFilter)
    : 'all'
}

interface Props {
  stageId: string
  stageName: string
  /** characterName -> image url; rebuilt into a Map (Maps don't cross the RSC boundary). */
  speakerImages: Record<string, string | null>
}

export function StageHistoryView({ stageId, stageName, speakerImages }: Props) {
  const searchParams = useSearchParams()
  const initialFilter = filterFromParam(searchParams.get('filter'))

  const speakerImageByName = useMemo(
    () => new Map(Object.entries(speakerImages)),
    [speakerImages],
  )

  // Mirror the filter into the URL for deep-linking WITHOUT a navigation —
  // router.replace would refetch the server component (re-running the queries)
  // and defeat the instant client-side filter. This is cosmetic only.
  const onFilterChange = useCallback((f: FeedFilter) => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (f === 'all') params.delete('filter')
    else params.set('filter', f)
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [])

  // The whole history is preloaded once, so switching filters is an instant
  // client-side subset — no refetch, no loading/empty flash.
  const feed = useStageFeed({
    stageId,
    initialItems: [],
    initialFilter,
    onFilterChange,
    preload: 'all',
  })

  // Copy / .md export reflect the current filter (and the filename says which).
  const markdown = formatFeedAsMarkdown(feed.visibleItems, stageName)
  const downloadMd = useCallback(() => {
    const slug = stageName.replace(/\s+/g, '-').toLowerCase()
    // Use the chip label (lines/scenes/twists), not the internal filter id.
    const filterSlug =
      FEED_FILTERS.find((f) => f.id === feed.filter)?.label.toLowerCase() ?? feed.filter
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slug}-script-${filterSlug}.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [markdown, stageName, feed.filter])

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-4 max-md:px-3 max-md:py-3">
      <header className="flex items-start justify-between gap-4 border-b border-[#242424]/60 pb-3 max-md:gap-3">
        <div className="min-w-0">
          <Link
            href={`/stage/${stageId}`}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#888880] transition-colors hover:text-[#F0EDE8]"
          >
            <span aria-hidden>←</span> Back to stage
          </Link>
          <h1
            className="mt-1 truncate text-[24px] font-light italic leading-none text-[#F0EDE8] max-md:text-[18px]"
            style={{ fontFamily: 'var(--font-display)' }}
            title={stageName}
          >
            {stageName} — history
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 max-md:gap-1.5">
          <CopyButton text={markdown} label="Copy script" />
          <button
            type="button"
            onClick={downloadMd}
            className="inline-flex h-8 items-center gap-1.5 rounded border border-[#3A3A3A] px-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#888880] transition-colors hover:border-[#444440] hover:bg-[#161616] hover:text-[#F0EDE8] max-md:h-7 max-md:px-2 max-md:text-[8px]"
          >
            .md
          </button>
        </div>
      </header>

      <IndicatorLegend className="py-2" />

      <div className={cn('min-h-0 flex-1')}>
        <StageFeed
          feed={feed}
          currentLine={null}
          speakerImageByName={speakerImageByName}
          variant="full"
        />
      </div>
    </div>
  )
}
