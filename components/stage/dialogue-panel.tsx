'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { FeedItem } from '@/lib/stage/feed-items'
import { normalizeEmoteAction } from '@/lib/stage/dialogue-format'
import { cn } from '@/lib/utils'
import { DialogueHistoryModal } from './dialogue-history-modal'
import { DialogueText } from './dialogue-text'
import { SceneBanner, type CurrentScene } from './scene-banner'
import { SceneScriptMarker, TwistScriptMarker } from './script-timeline-markers'
import { SectionCollapsibleHeader } from './section-collapsible-header'
import {
  AVATAR,
  AVATAR_PLACEHOLDER,
  LINK_MICRO,
  LIVE_DOT,
  MONO_BODY,
  MONO_BODY_SM,
  MONO_LABEL,
  MONO_MUTED,
  PANEL_HEADER_INSET,
  PANEL_INSET,
  PANEL_STACK_GAP,
  TYPEWRITER_CURSOR,
} from './stage-mobile-classes'

export interface CurrentDialogue {
  eventId: string
  createdAt: number
  speakerName: string
  text: string
  displayedText: string
  isEmote?: boolean
  speakerImageUrl?: string | null
}

interface Props {
  stageId: string
  stageName: string
  dialogue: CurrentDialogue | null
  recentItemsDesktop: FeedItem[]
  recentItemsMobile: FeedItem[]
  allHistoryItems: FeedItem[]
  feedBumpKey: number
  currentScene: CurrentScene | null
  recentScenes: FeedItem[]
  speakerImageByName: Map<string, string | null>
}

function resolveSpeakerImage(
  item: FeedItem & { kind: 'dialogue' },
  speakerImageByName: Map<string, string | null>,
): string | null {
  return item.speakerImageUrl ?? speakerImageByName.get(item.speakerName) ?? null
}


function RecentScriptList({
  items,
  speakerImageByName,
  className,
}: {
  items: FeedItem[]
  speakerImageByName: Map<string, string | null>
  className?: string
}) {
  if (items.length === 0) return null

  return (
    <ul
      className={cn('flex flex-col', PANEL_STACK_GAP, className)}
      aria-label="Recent script entries"
    >
      {items.map((item, index) => {
        const enterClass = cn(
          'stage-feed-enter',
          item.kind === 'dialogue' && 'border-l-2 border-l-transparent pl-2',
        )
        if (item.kind === 'dialogue') {
          const imageUrl = resolveSpeakerImage(item, speakerImageByName)
          return (
            <li
              key={item.id}
              className={enterClass}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <DialogueRow item={item} imageUrl={imageUrl} />
            </li>
          )
        }
        if (item.kind === 'scene') {
          return (
            <li
              key={item.id}
              className={enterClass}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <SceneScriptMarker name={item.name} description={item.description} />
            </li>
          )
        }
        return (
          <li
            key={item.id}
            className={enterClass}
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <TwistScriptMarker userDisplayName={item.userDisplayName} text={item.text} />
          </li>
        )
      })}
    </ul>
  )
}

function DialogueRow({
  item,
  imageUrl,
}: {
  item: FeedItem & { kind: 'dialogue' }
  imageUrl: string | null
}) {
  return (
    <div className="flex items-start gap-2.5 max-md:gap-2">
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
        <span className="text-[#C41E3A]/80">{item.speakerName}:</span>{' '}
        {item.isEmote ? (
          <em>{normalizeEmoteAction(item.text)}</em>
        ) : (
          <DialogueText text={item.text} />
        )}
      </p>
    </div>
  )
}

function CurrentSpeakerMeta({ speakerName }: { speakerName: string }) {
  return (
    <span
      className={cn(
        'flex min-w-0 items-center justify-end gap-1.5 truncate font-medium text-[#C41E3A]',
        MONO_LABEL,
      )}
      title={speakerName}
    >
      <span
        className={cn(
          LIVE_DOT,
          'rounded-full bg-[#C41E3A] shadow-[0_0_6px_rgba(196,30,58,0.8)] animate-pulse',
        )}
        aria-hidden
      />
      <span className="truncate">{speakerName}</span>
    </span>
  )
}

export function DialoguePanel({
  stageId,
  stageName,
  dialogue,
  recentItemsDesktop,
  recentItemsMobile,
  allHistoryItems,
  feedBumpKey,
  currentScene,
  recentScenes,
  speakerImageByName,
}: Props) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const [scriptOpen, setScriptOpen] = useState(true)
  const hasRecentItems =
    recentItemsDesktop.length > 0 || recentItemsMobile.length > 0

  return (
    <>
      <section className="glass-hud pointer-events-auto w-full rounded-sm border-l-2 border-l-[#C41E3A]/70 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        <SceneBanner
          scene={currentScene}
          stageId={stageId}
          stageName={stageName}
          recentScenes={recentScenes}
        />

        <SectionCollapsibleHeader
          title="Script"
          meta={
            dialogue ? (
              <CurrentSpeakerMeta speakerName={dialogue.speakerName} />
            ) : undefined
          }
          open={scriptOpen}
          onClick={() => setScriptOpen((v) => !v)}
          ariaLabelExpanded="Collapse script"
          ariaLabelCollapsed="Expand script"
          className={cn(
            'border-t border-[#242424]/50 transition-colors hover:border-[#3A3A3A]',
            PANEL_HEADER_INSET,
          )}
        />

        {scriptOpen && (
          <div className={cn('flex flex-col', PANEL_STACK_GAP, PANEL_INSET)}>
            <div className="flex items-start gap-2.5 border-l-2 border-l-[#C41E3A]/70 pl-2 max-md:gap-2 max-md:pl-1.5">
              <div className={cn(AVATAR, 'bg-[#0e0e0e]/70 ring-1 ring-[#242424]/60')}>
                {dialogue?.speakerImageUrl ? (
                  <Image
                    src={dialogue.speakerImageUrl}
                    alt={dialogue.speakerName}
                    width={36}
                    height={36}
                    className="h-full w-full object-cover image-pixelated"
                  />
                ) : (
                  <div className={AVATAR_PLACEHOLDER}>◈</div>
                )}
              </div>
              <div className="min-h-[2.5rem] min-w-0 flex-1 max-md:min-h-[2rem]">
                {dialogue ? (
                  <>
                    <p className={cn('mb-0.5 text-[#C41E3A]', MONO_LABEL)}>
                      {dialogue.speakerName}
                    </p>
                    <p className={cn(MONO_BODY, 'text-[#F0EDE8]')}>
                      {dialogue.isEmote ? (
                        <em className="text-[#888880]">
                          {normalizeEmoteAction(dialogue.displayedText)}
                        </em>
                      ) : (
                        <DialogueText text={dialogue.displayedText} />
                      )}
                      <span
                        className={cn(TYPEWRITER_CURSOR, 'bg-[#C41E3A] animate-pulse-live')}
                      />
                    </p>
                  </>
                ) : (
                  <p className={cn(MONO_BODY, 'text-[#444440]')}>
                    Waiting for the stage to speak…
                  </p>
                )}
              </div>
            </div>

            {hasRecentItems ? (
              <div key={feedBumpKey}>
                <RecentScriptList
                  items={recentItemsDesktop}
                  speakerImageByName={speakerImageByName}
                  className="max-sm:hidden"
                />
                <RecentScriptList
                  items={recentItemsMobile}
                  speakerImageByName={speakerImageByName}
                  className="sm:hidden"
                />
              </div>
            ) : (
              !dialogue && (
                <p className={MONO_MUTED}>No prior script entries.</p>
              )
            )}
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className={cn(
                LINK_MICRO,
                'inline-flex w-fit text-[#888880] underline-offset-2 transition-colors hover:text-[#F0EDE8] hover:underline',
              )}
            >
              Script history
            </button>
          </div>
        )}
      </section>

      <DialogueHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        stageId={stageId}
        stageName={stageName}
        initialItems={allHistoryItems}
      />
    </>
  )
}
