'use client'

import Image from 'next/image'
import { castHeadline, castSubline, type FeedItem } from '@/lib/stage/feed-items'
import { FEED_FILTERS, type FeedFilter } from '@/lib/stage/feed-state'
import { normalizeEmoteAction } from '@/lib/stage/dialogue-format'
import { cn } from '@/lib/utils'
import { DialogueText } from './dialogue-text'
import { SceneScriptMarker, TwistScriptMarker } from './script-timeline-markers'
import type { StageFeedController } from './use-stage-feed'
import {
  AVATAR,
  AVATAR_PLACEHOLDER,
  MONO_BODY,
  MONO_MUTED,
  PANEL_STACK_GAP,
  TYPEWRITER_CURSOR,
} from './stage-mobile-classes'

const OWN_GOLD = '#B8860B'

const EMPTY_MESSAGES: Record<FeedFilter, string> = {
  all: 'Nothing has happened on this stage yet.',
  dialogue: 'No lines yet.',
  scene: 'No scene changes yet.',
  twist: 'No twists yet — be the first to inject one.',
  cast: 'No arrivals or exits yet.',
  mine: 'None of your characters have spoken yet.',
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-2 py-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start gap-2.5 max-md:gap-2">
          <div className="h-9 w-9 shrink-0 animate-pulse-load rounded-sm bg-[#161616] max-md:h-7 max-md:w-7" />
          <div className="flex-1 space-y-1.5 pt-1">
            <div className="h-2 w-20 animate-pulse-load rounded bg-[#161616]" />
            <div className="h-2 w-full animate-pulse-load rounded bg-[#161616]" />
          </div>
        </div>
      ))}
    </div>
  )
}

export interface CurrentLine {
  eventId: string
  createdAt: number
  speakerName: string
  text: string
  displayedText: string
  isEmote?: boolean
  speakerImageUrl?: string | null
  isOwn?: boolean
}

interface Props {
  feed: StageFeedController
  currentLine: CurrentLine | null
  speakerImageByName: Map<string, string | null>
  variant?: 'panel' | 'full'
}

function YouChip() {
  return (
    <span
      className="ml-1.5 inline-flex items-center rounded-sm px-1 py-px align-middle font-mono text-[8px] uppercase tracking-[0.14em]"
      style={{ color: OWN_GOLD, border: `1px solid ${OWN_GOLD}66` }}
      title="Your character"
    >
      You
    </span>
  )
}

function speakerImage(
  item: FeedItem & { kind: 'dialogue' },
  speakerImageByName: Map<string, string | null>,
): string | null {
  return item.speakerImageUrl ?? speakerImageByName.get(item.speakerName) ?? null
}

function DialogueRow({
  speakerName,
  text,
  isEmote,
  isOwn,
  imageUrl,
  live = false,
}: {
  speakerName: string
  text: string
  isEmote?: boolean
  isOwn?: boolean
  imageUrl: string | null
  /** The live, still-animating line: append the pulsing typewriter cursor. */
  live?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 border-l-2 pl-2 max-md:gap-2',
        isOwn ? '' : 'border-l-transparent',
      )}
      style={isOwn ? { borderLeftColor: OWN_GOLD } : undefined}
    >
      <div className={cn(AVATAR, 'bg-[#0e0e0e]/70 ring-1 ring-[#242424]/60')}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={speakerName}
            width={36}
            height={36}
            className="h-full w-full object-cover image-pixelated"
          />
        ) : (
          <div className={AVATAR_PLACEHOLDER}>◈</div>
        )}
      </div>
      <p className={cn('min-w-0 flex-1 text-[#F0EDE8]', MONO_BODY)}>
        <span className="text-[#C41E3A]">{speakerName}:</span>
        {isOwn ? <YouChip /> : null}{' '}
        {isEmote ? (
          <em className="text-[#888880]">{normalizeEmoteAction(text)}</em>
        ) : (
          <DialogueText text={text} />
        )}
        {live ? (
          <span className={cn(TYPEWRITER_CURSOR, 'bg-[#C41E3A] animate-pulse-live')} />
        ) : null}
      </p>
    </div>
  )
}

function CastMarker({ item }: { item: FeedItem & { kind: 'cast' } }) {
  const verb = item.action === 'joined' ? 'joined the stage' : 'left the stage'
  const subline = castSubline(item)
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-center font-mono text-[10px] tracking-[0.12em] text-[#888880] max-md:text-[8px]">
        <span className="text-[#444440]" aria-hidden>
          ──{' '}
        </span>
        <span className="uppercase">{castHeadline(item)}</span> {verb}
        <span className="text-[#444440]" aria-hidden>
          {' '}
          ──
        </span>
      </p>
      {subline ? (
        <p className="text-center font-mono text-[9px] uppercase tracking-[0.12em] text-[#555] max-md:text-[8px]">
          {subline}
        </p>
      ) : null}
    </div>
  )
}

function FeedRow({
  item,
  speakerImageByName,
}: {
  item: FeedItem
  speakerImageByName: Map<string, string | null>
}) {
  if (item.kind === 'dialogue') {
    return (
      <DialogueRow
        speakerName={item.speakerName}
        text={item.text}
        isEmote={item.isEmote}
        isOwn={item.isOwn}
        imageUrl={speakerImage(item, speakerImageByName)}
      />
    )
  }
  if (item.kind === 'scene') {
    return <SceneScriptMarker name={item.name} description={item.description} />
  }
  if (item.kind === 'twist') {
    return <TwistScriptMarker userDisplayName={item.userDisplayName} text={item.text} />
  }
  return <CastMarker item={item} />
}

export function StageFeed({ feed, currentLine, speakerImageByName, variant = 'panel' }: Props) {
  const {
    filter,
    setFilter,
    visibleItems,
    hasMore,
    total,
    loading,
    preloading,
    loadingOlder,
    following,
    unread,
    jumpToLatest,
    scrollRef,
    sentinelRef,
    onScroll,
  } = feed

  // The live, animating line lives in `currentLine` until it's archived into the
  // feed; drop it from the completed rows so it isn't shown twice.
  const rows = currentLine
    ? visibleItems.filter((i) => i.id !== currentLine.eventId)
    : visibleItems

  // The live line is a dialogue line — surface it (newest-first, at the top of
  // the list, scrolling with everything else) only when the active filter would
  // include it. It's never pinned; scroll past it like any other line.
  const showLive =
    variant === 'panel' &&
    currentLine != null &&
    (filter === 'all' || filter === 'dialogue' || (filter === 'mine' && Boolean(currentLine.isOwn)))

  const shownCount = rows.length + (showLive ? 1 : 0)
  const marker = loading
    ? 'Loading…'
    : filter === 'all' && total !== null
      ? `Showing ${shownCount} of ${total}`
      : `Showing ${shownCount}`

  // Panel fills its column down to the cast rail and scrolls internally. On lg the
  // scroller is taken out of flow (absolute inset-0) so the feed's content doesn't
  // inflate the grid row — the row height is driven by the rail, and the feed fills
  // it. Below lg it's a single in-flow column, so cap the height. The full history
  // flows with the page so the footer sits below the content, not over it.
  const scrollClass =
    variant === 'full'
      ? ''
      : 'overflow-y-auto max-h-[24rem] max-md:max-h-[18rem] lg:absolute lg:inset-0 lg:max-h-none'

  // Show a skeleton while the first page (or a still-empty filter mid-preload)
  // is loading — never the empty-state text in place of a loading animation.
  const showSkeleton = shownCount === 0 && (loading || preloading || loadingOlder)

  return (
    <div className={cn('flex flex-col gap-2', variant === 'panel' && 'lg:min-h-0 lg:flex-1')}>
      {/* Filter chips + depth marker */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FEED_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={cn(
              'rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors max-md:text-[8px]',
              filter === f.id
                ? 'border-[#C41E3A] bg-[#C41E3A]/15 text-[#F0EDE8]'
                : 'border-[#2A2A2A] text-[#888880] hover:border-[#3A3A3A] hover:text-[#F0EDE8]',
            )}
          >
            {f.label}
          </button>
        ))}
        <span className={cn('ml-auto', MONO_MUTED)}>{marker}</span>
      </div>

      {/* Timeline, newest-first, scroll down for older. The live line (when it
          matches the filter) rides at the top and scrolls with everything else. */}
      <div
        className={cn(
          'relative',
          variant === 'panel' && 'lg:min-h-0 lg:flex-1',
        )}
      >
        {!following && unread > 0 && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="absolute left-1/2 top-1 z-10 -translate-x-1/2 rounded-full border border-[#C41E3A] bg-[#2a1417] px-3 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#e05561] shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-colors hover:text-[#F0EDE8] max-md:text-[8px]"
          >
            ↑ {unread} new {unread === 1 ? 'line' : 'lines'}
          </button>
        )}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className={cn(scrollClass, 'flex flex-col pt-1', PANEL_STACK_GAP)}
          aria-label="Stage feed"
        >
          {showSkeleton ? (
            <SkeletonRows />
          ) : shownCount === 0 ? (
            <p className={cn('py-1', MONO_MUTED)}>{EMPTY_MESSAGES[filter]}</p>
          ) : (
            <ul className={cn('flex flex-col', PANEL_STACK_GAP)}>
              {showLive && currentLine ? (
                <li key={currentLine.eventId} className="stage-feed-enter">
                  <DialogueRow
                    speakerName={currentLine.speakerName}
                    text={currentLine.displayedText}
                    isEmote={currentLine.isEmote}
                    isOwn={currentLine.isOwn}
                    imageUrl={
                      currentLine.speakerImageUrl ??
                      speakerImageByName.get(currentLine.speakerName) ??
                      null
                    }
                    live
                  />
                </li>
              ) : null}
              {rows.map((item) => (
                <li key={item.id} className="stage-feed-enter">
                  <FeedRow item={item} speakerImageByName={speakerImageByName} />
                </li>
              ))}
            </ul>
          )}
          {hasMore ? (
            <div ref={sentinelRef}>{loadingOlder && rows.length > 0 && <SkeletonRows />}</div>
          ) : (
            rows.length > 0 && (
              <p className={cn('py-2 text-center', MONO_MUTED)}>Beginning of the stage.</p>
            )
          )}
        </div>
      </div>
    </div>
  )
}
