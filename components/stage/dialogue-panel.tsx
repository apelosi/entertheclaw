'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { FeedItem } from '@/lib/stage/feed-items'
import { cn } from '@/lib/utils'
import { DialogueHistoryModal } from './dialogue-history-modal'
import { SceneBanner, type CurrentScene } from './scene-banner'
import { SectionCollapsibleHeader } from './section-collapsible-header'

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
  const [recentOpen, setRecentOpen] = useState(false)

  return (
    <>
      <section className="glass-hud pointer-events-auto w-full rounded-sm border-l-2 border-l-[#C41E3A]/70 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        <SceneBanner
          scene={currentScene}
          stageId={stageId}
          stageName={stageName}
          recentScenes={recentScenes}
        />

        <div className="flex items-start gap-3 p-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-sm bg-[#0e0e0e]/70 ring-1 ring-[#242424]/60">
            {dialogue?.speakerImageUrl ? (
              <Image
                src={dialogue.speakerImageUrl}
                alt={dialogue.speakerName}
                width={48}
                height={48}
                className="h-full w-full object-cover image-pixelated"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[#444440]">
                <span>◈</span>
              </div>
            )}
          </div>

          <div className="min-h-[3rem] flex-1">
            {dialogue ? (
              <>
                <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#C41E3A]">
                  {dialogue.speakerName}
                </p>
                <p className="font-mono text-[13px] leading-relaxed text-[#F0EDE8]">
                  {dialogue.isEmote ? (
                    <em className="text-[#888880]">{dialogue.displayedText}</em>
                  ) : (
                    dialogue.displayedText
                  )}
                  <span className="ml-1 inline-block h-3.5 w-1.5 align-middle bg-[#C41E3A] animate-pulse-live" />
                </p>
              </>
            ) : (
              <p className="font-mono text-[13px] leading-relaxed text-[#444440]">
                Waiting for the stage to speak…
              </p>
            )}
          </div>
        </div>

        <SectionCollapsibleHeader
          title="Script"
          open={recentOpen}
          onClick={() => setRecentOpen((v) => !v)}
          ariaLabelExpanded="Collapse script"
          ariaLabelCollapsed="Expand script"
          className="border-t border-[#242424]/50 px-3 py-2 transition-colors hover:border-[#3A3A3A]"
        />

        {recentOpen && (
          <div className="flex flex-col gap-2 px-3 pb-3">
            {recentItems.length > 0 ? (
              <ul
                key={feedBumpKey}
                className="flex flex-col gap-2.5"
                aria-label="Recent script entries"
              >
                {recentItems.map((item, index) => {
                  const enterClass = cn(
                    'stage-feed-enter border-l-2 pl-2',
                    item.kind === 'twist'
                      ? 'border-l-[#B8860B]/80'
                      : item.kind === 'scene'
                        ? 'border-l-[#2A8E8E]/80'
                        : 'border-l-transparent',
                  )
                  if (item.kind === 'dialogue') {
                    const imageUrl = resolveSpeakerImage(item, speakerImageByName)
                    return (
                      <li
                        key={item.id}
                        className={enterClass}
                        style={{ animationDelay: `${index * 40}ms` }}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-sm bg-[#0e0e0e]/70 ring-1 ring-[#242424]/60">
                            {imageUrl ? (
                              <Image
                                src={imageUrl}
                                alt={item.speakerName}
                                width={36}
                                height={36}
                                className="h-full w-full object-cover image-pixelated"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm text-[#444440]">
                                ◈
                              </div>
                            )}
                          </div>
                          <p className="min-w-0 flex-1 font-mono text-[11px] leading-relaxed text-[#888880]">
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
                        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#2A8E8E]">
                          Scene · {item.name}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] italic leading-relaxed text-[#888880]">
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
                      <p className="font-mono text-[11px] italic leading-relaxed text-[#B8860B]/90">
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
              <p className="font-mono text-[11px] text-[#444440]">No prior script entries.</p>
            )}
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="mt-1 inline-flex w-fit font-mono text-[10px] uppercase tracking-[0.18em] text-[#888880] underline-offset-2 transition-colors hover:text-[#F0EDE8] hover:underline"
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
