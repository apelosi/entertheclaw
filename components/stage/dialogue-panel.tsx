'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { FeedItem } from '@/lib/stage/feed-items'
import { DialogueHistoryModal } from './dialogue-history-modal'
import { SceneBanner, type CurrentScene } from './scene-banner'

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
  lineCount: number
  currentScene: CurrentScene | null
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
  lineCount,
  currentScene,
  speakerImageByName,
}: Props) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const [recentOpen, setRecentOpen] = useState(false)

  return (
    <>
      <section className="glass-hud pointer-events-auto w-full rounded-sm border-l-2 border-l-[#C41E3A]/70 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        <SceneBanner scene={currentScene} />

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

        <button
          type="button"
          onClick={() => setRecentOpen((v) => !v)}
          className="flex w-full items-center gap-3 border-t border-[#242424]/50 px-3 py-2 transition-colors hover:border-[#3A3A3A]"
          aria-expanded={recentOpen}
          aria-label={recentOpen ? 'Collapse script' : 'Expand script'}
        >
          <h3
            className="text-base font-semibold tracking-[-0.02em] text-[#F0EDE8]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Script
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#888880]">
            {lineCount} line{lineCount !== 1 ? 's' : ''}
          </span>
          <span
            className={cn(
              'ml-auto text-base leading-none text-[#444440] transition-transform',
              recentOpen && 'rotate-180',
            )}
            aria-hidden
          >
            ▾
          </span>
        </button>

        {recentOpen && (
          <div className="flex flex-col gap-2 px-3 pb-3">
            {recentItems.length > 0 ? (
              <ul key={feedBumpKey} className="flex flex-col gap-2.5" aria-label="Recent lines">
                {recentItems.map((item, index) => {
                  if (item.kind !== 'dialogue') return null
                  const imageUrl = resolveSpeakerImage(item, speakerImageByName)
                  return (
                    <li
                      key={item.id}
                      className="stage-feed-enter flex items-start gap-2.5"
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
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
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="font-mono text-[11px] text-[#444440]">No prior lines.</p>
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
