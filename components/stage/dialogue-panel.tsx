'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { FeedItem } from '@/lib/stage/feed-items'
import { DialogueHistoryModal } from './dialogue-history-modal'

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
}

export function DialoguePanel({
  stageId,
  stageName,
  dialogue,
  recentItems,
  allHistoryItems,
  feedBumpKey,
}: Props) {
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <>
      <section className="glass-hud pointer-events-auto flex w-full flex-col gap-2.5 rounded-sm border-l-2 border-l-[#C41E3A]/70 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        <header className="flex items-baseline justify-between gap-3">
          <h3
            className="text-[20px] font-light italic leading-none tracking-[-0.02em] text-[#F0EDE8]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Dialogue
          </h3>
          {dialogue && (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#C41E3A]">
              {dialogue.speakerName}
            </span>
          )}
        </header>

        <div className="flex items-start gap-3">
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
              <p className="font-mono text-[13px] leading-relaxed text-[#F0EDE8]">
                {dialogue.isEmote ? (
                  <em className="text-[#888880]">{dialogue.displayedText}</em>
                ) : (
                  dialogue.displayedText
                )}
                <span className="ml-1 inline-block h-3.5 w-1.5 align-middle bg-[#C41E3A] animate-pulse-live" />
              </p>
            ) : (
              <p className="font-mono text-[13px] leading-relaxed text-[#444440]">
                Waiting for the stage to speak…
              </p>
            )}
          </div>
        </div>

        {recentItems.length > 0 && (
          <ul
            key={feedBumpKey}
            className="flex flex-col gap-2 border-t border-[#242424]/50 pt-3"
            aria-label="Recent lines"
          >
            {recentItems.map((item, index) => (
              <li
                key={item.id}
                className={cn(
                  'stage-feed-enter font-mono text-[11px] leading-relaxed',
                  item.kind === 'twist' ? 'text-[#B8860B]/90' : 'text-[#888880]',
                )}
                style={{ animationDelay: `${index * 40}ms` }}
              >
                {item.kind === 'twist' ? (
                  <span>
                    <span className="uppercase tracking-[0.12em] text-[#B8860B]">
                      Twist
                    </span>
                    {' · '}
                    <span className="italic text-[#888880]">“{item.text}”</span>
                  </span>
                ) : (
                  <span>
                    <span className="text-[#C41E3A]/80">{item.speakerName}:</span>{' '}
                    {item.isEmote ? (
                      <em>{item.text}</em>
                    ) : (
                      item.text
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="mt-1 inline-flex w-fit font-mono text-[10px] uppercase tracking-[0.18em] text-[#888880] underline-offset-2 transition-colors hover:text-[#F0EDE8] hover:underline"
        >
          Dialogue history
        </button>
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
