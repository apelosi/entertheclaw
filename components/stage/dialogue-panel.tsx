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
}: Props) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const [recentOpen, setRecentOpen] = useState(false)

  return (
    <>
      <section className="glass-hud pointer-events-auto w-full rounded-sm border-l-2 border-l-[#C41E3A]/70 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        {/* Scene context — always visible above the current line */}
        <SceneBanner scene={currentScene} />

        {/* Current line — always visible */}
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

        {/* Thin separator with ▾ toggle on far right */}
        <button
          type="button"
          onClick={() => setRecentOpen((v) => !v)}
          className="flex w-full items-center justify-end border-t border-[#242424]/50 px-3 py-1.5 transition-colors hover:border-[#3A3A3A]"
          aria-label={recentOpen ? 'Collapse history' : 'Expand history'}
        >
          <span
            className={cn(
              'text-[10px] text-[#444440] transition-transform',
              recentOpen && 'rotate-180',
            )}
          >
            ▾
          </span>
        </button>

        {/* Recent lines — shown when expanded */}
        {recentOpen && (
          <div className="flex flex-col gap-2 px-3 pb-3">
            {recentItems.length > 0 ? (
              <>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#444440]">
                  Recent · {lineCount} line{lineCount !== 1 ? 's' : ''}
                </p>
                <ul key={feedBumpKey} className="flex flex-col gap-2" aria-label="Recent lines">
                  {recentItems.map((item, index) => (
                    <li
                      key={item.id}
                      className="stage-feed-enter font-mono text-[11px] leading-relaxed text-[#888880]"
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      {item.kind === 'dialogue' && (
                        <span>
                          <span className="text-[#C41E3A]/80">{item.speakerName}:</span>{' '}
                          {item.isEmote ? <em>{item.text}</em> : item.text}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="font-mono text-[11px] text-[#444440]">No prior lines.</p>
            )}
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="mt-1 inline-flex w-fit font-mono text-[10px] uppercase tracking-[0.18em] text-[#888880] underline-offset-2 transition-colors hover:text-[#F0EDE8] hover:underline"
            >
              Full history
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
