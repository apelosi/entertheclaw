'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { FeedItem } from '@/lib/stage/feed-items'
import { cn } from '@/lib/utils'
import { DialogueHistoryModal } from './dialogue-history-modal'
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

const RECENT_SCRIPT_LIMIT_MOBILE = 3
const RECENT_SCRIPT_LIMIT_DESKTOP = 5

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
  recentItems: FeedItem[]
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
  recentItems,
  allHistoryItems,
  feedBumpKey,
  currentScene,
  recentScenes,
  speakerImageByName,
}: Props) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const [scriptOpen, setScriptOpen] = useState(true)
  const visibleRecentItems = recentItems.slice(0, RECENT_SCRIPT_LIMIT_DESKTOP)

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
                        <em className="text-[#888880]">{dialogue.displayedText}</em>
                      ) : (
                        dialogue.displayedText
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

            {visibleRecentItems.length > 0 ? (
              <ul
                key={feedBumpKey}
                className={cn('flex flex-col', PANEL_STACK_GAP)}
                aria-label="Recent script entries"
              >
                {visibleRecentItems.map((item, index) => {
                  const enterClass = cn(
                    'stage-feed-enter',
                    item.kind === 'dialogue' && 'border-l-2 border-l-transparent pl-2',
                    index >= RECENT_SCRIPT_LIMIT_MOBILE && 'max-sm:hidden',
                  )
                  if (item.kind === 'dialogue') {
                    const imageUrl = resolveSpeakerImage(item, speakerImageByName)
                    return (
                      <li
                        key={item.id}
                        className={enterClass}
                        style={{ animationDelay: `${index * 40}ms` }}
                      >
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
                            {item.isEmote ? <em>{item.text}</em> : item.text}
                          </p>
                        </div>
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
                        <p className={cn(MONO_LABEL, 'tracking-[0.12em] text-[#2A8E8E]')}>
                          Scene · {item.name}
                        </p>
                        <p className={cn('mt-0.5 italic text-[#888880]', MONO_BODY_SM)}>
                          {item.description}
                        </p>
                      </li>
                    )
                  }
                  return (
                    <li
                      key={item.id}
                      className={enterClass}
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <p className={cn('italic text-[#B8860B]/90', MONO_BODY_SM)}>
                        <span className="not-italic text-[#888880]">
                          {item.userDisplayName}:
                        </span>{' '}
                        &ldquo;{item.text}&rdquo;
                      </p>
                    </li>
                  )
                })}
              </ul>
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
