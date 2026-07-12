'use client'

import Image from 'next/image'
import type { FeedItem } from '@/lib/stage/feed-items'
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
  MONO_BODY_SM,
  MONO_LABEL,
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
  item,
  imageUrl,
}: {
  item: FeedItem & { kind: 'dialogue' }
  imageUrl: string | null
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 border-l-2 pl-2 max-md:gap-2',
        item.isOwn ? '' : 'border-l-transparent',
      )}
      style={item.isOwn ? { borderLeftColor: OWN_GOLD } : undefined}
    >
      <div className={cn(AVATAR, 'bg-[#0e0e0e]/70 ring-1 ring-[#242424]/60')}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={item.speakerName}
            width={36}
            height={36}
            className="h-full w-full object-cover image-pixelated"
          />
        ) : (
          <div className={AVATAR_PLACEHOLDER}>◈</div>
        )}
      </div>
      <p className={cn('min-w-0 flex-1 text-[#888880]', MONO_BODY_SM)}>
        <span className="text-[#C41E3A]/80">{item.speakerName}:</span>
        {item.isOwn ? <YouChip /> : null}{' '}
        {item.isEmote ? (
          <em>{normalizeEmoteAction(item.text)}</em>
        ) : (
          <DialogueText text={item.text} />
        )}
      </p>
    </div>
  )
}

function CastMarker({ item }: { item: FeedItem & { kind: 'cast' } }) {
  const verb = item.action === 'joined' ? 'joined the stage' : 'left the stage'
  return (
    <p
      className="text-center font-mono text-[10px] tracking-[0.12em] text-[#666] max-md:text-[8px]"
      title={`${item.agentName} ${verb}`}
    >
      <span className="text-[#444440]" aria-hidden>
        ──{' '}
      </span>
      <span className="uppercase">{item.agentName}</span> {verb}
      <span className="text-[#444440]" aria-hidden>
        {' '}
        ──
      </span>
    </p>
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
    return <DialogueRow item={item} imageUrl={speakerImage(item, speakerImageByName)} />
  }
  if (item.kind === 'scene') {
    return <SceneScriptMarker name={item.name} description={item.description} />
  }
  if (item.kind === 'twist') {
    return <TwistScriptMarker userDisplayName={item.userDisplayName} text={item.text} />
  }
  return <CastMarker item={item} />
}

function PinnedCurrentLine({ line }: { line: CurrentLine | null }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 border-l-2 pl-2 max-md:gap-2 max-md:pl-1.5',
        line?.isOwn ? '' : 'border-l-transparent',
      )}
      style={line?.isOwn ? { borderLeftColor: OWN_GOLD } : undefined}
    >
      <div className={cn(AVATAR, 'bg-[#0e0e0e]/70 ring-1 ring-[#242424]/60')}>
        {line?.speakerImageUrl ? (
          <Image
            src={line.speakerImageUrl}
            alt={line.speakerName}
            width={36}
            height={36}
            className="h-full w-full object-cover image-pixelated"
          />
        ) : (
          <div className={AVATAR_PLACEHOLDER}>◈</div>
        )}
      </div>
      <div className="min-h-[2.5rem] min-w-0 flex-1 max-md:min-h-[2rem]">
        {line ? (
          <>
            <p className={cn('mb-0.5 text-[#C41E3A]', MONO_LABEL)}>
              {line.speakerName}
              {line.isOwn ? <YouChip /> : null}
            </p>
            <p className={cn(MONO_BODY, 'text-[#F0EDE8]')}>
              {line.isEmote ? (
                <em className="text-[#888880]">{normalizeEmoteAction(line.displayedText)}</em>
              ) : (
                <DialogueText text={line.displayedText} />
              )}
              <span className={cn(TYPEWRITER_CURSOR, 'bg-[#C41E3A] animate-pulse-live')} />
            </p>
          </>
        ) : (
          <p className={cn(MONO_BODY, 'text-[#444440]')}>Waiting for the stage to speak…</p>
        )}
      </div>
    </div>
  )
}

export function StageFeed({ feed, currentLine, speakerImageByName, variant = 'panel' }: Props) {
  const {
    filter,
    setFilter,
    visibleItems,
    hasMore,
    total,
    loadingOlder,
    following,
    unread,
    jumpToLatest,
    scrollRef,
    sentinelRef,
    onScroll,
  } = feed

  // The animating line is shown pinned above; don't repeat it in the list.
  const rows = currentLine
    ? visibleItems.filter((i) => i.id !== currentLine.eventId)
    : visibleItems

  const marker =
    filter === 'all' && total !== null
      ? `Showing ${rows.length} of ${total}`
      : `Showing ${rows.length}`

  const scrollClass =
    variant === 'full'
      ? 'min-h-0 flex-1 overflow-y-auto'
      : 'max-h-[24rem] overflow-y-auto max-md:max-h-[18rem]'

  return (
    <div
      className={cn(
        'flex flex-col gap-2',
        variant === 'full' && 'h-full min-h-0',
      )}
    >
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

      {/* Pinned live line — only in the live panel; the history route (full) is
          a static archive with no current speaker. */}
      {variant === 'panel' && <PinnedCurrentLine line={currentLine} />}

      {/* Completed timeline, newest-first, scroll down for older */}
      <div className="relative">
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
          {rows.length === 0 && !loadingOlder ? (
            <p className={cn('py-1', MONO_MUTED)}>{EMPTY_MESSAGES[filter]}</p>
          ) : (
            <ul className={cn('flex flex-col', PANEL_STACK_GAP)}>
              {rows.map((item) => (
                <li key={item.id} className="stage-feed-enter">
                  <FeedRow item={item} speakerImageByName={speakerImageByName} />
                </li>
              ))}
            </ul>
          )}
          {hasMore ? (
            <div ref={sentinelRef}>
              {loadingOlder && <SkeletonRows />}
            </div>
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
