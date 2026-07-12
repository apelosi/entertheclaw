'use client'

import { useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CopyButton } from '@/components/ui/copy-button'
import { formatFeedAsMarkdown } from '@/lib/stage/feed-items'
import type { FeedFilter } from '@/lib/stage/feed-state'
import { cn } from '@/lib/utils'
import { IndicatorLegend } from './cast-card'
import { StageFeed } from './stage-feed'
import { useStageFeed } from './use-stage-feed'

const HISTORY_MOUNT_LIMIT = 30
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

function HistoryFeed({
  stageId,
  stageName,
  filter,
  onChangeFilter,
  speakerImageByName,
}: {
  stageId: string
  stageName: string
  filter: FeedFilter
  onChangeFilter: (f: FeedFilter) => void
  speakerImageByName: Map<string, string | null>
}) {
  const feed = useStageFeed({
    stageId,
    initialItems: [],
    initialFilter: filter,
    onFilterChange: onChangeFilter,
    mountFetchLimit: HISTORY_MOUNT_LIMIT,
  })

  const markdown = formatFeedAsMarkdown(feed.allItems, stageName)
  const downloadMd = useCallback(() => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${stageName.replace(/\s+/g, '-').toLowerCase()}-script.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [markdown, stageName])

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] w-full max-w-3xl flex-col px-4 py-4 max-md:px-3 max-md:py-3">
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

export function StageHistoryView({ stageId, stageName, speakerImages }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const filter = filterFromParam(searchParams.get('filter'))

  const speakerImageByName = useMemo(
    () => new Map(Object.entries(speakerImages)),
    [speakerImages],
  )

  const onChangeFilter = useCallback(
    (f: FeedFilter) => {
      const params = new URLSearchParams(Array.from(searchParams.entries()))
      if (f === 'all') params.delete('filter')
      else params.set('filter', f)
      const qs = params.toString()
      router.replace(qs ? `?${qs}` : '?', { scroll: false })
    },
    [router, searchParams],
  )

  // Remount the feed when the filter changes so it refetches a fresh, dense
  // first page (and an accurate total) for the new type set.
  return (
    <HistoryFeed
      key={filter}
      stageId={stageId}
      stageName={stageName}
      filter={filter}
      onChangeFilter={onChangeFilter}
      speakerImageByName={speakerImageByName}
    />
  )
}
