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
  lineCount: number
  collapsible?: boolean
  defaultOpen?: boolean
}

export function DialoguePanel({
  stageId,
  stageName,
  dialogue,
  recentItems,
  allHistoryItems,
  feedBumpKey,
  lineCount,
  collapsible = false,
  defaultOpen = true,
}: Props) {
  const [panelOpen, setPanelOpen] = useState(defaultOpen)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [recentOpen, setRecentOpen] = useState(false)

  const speakerLabel = dialogue?.speakerName ?? null

  const content = (
    <>
      {/* Portrait + current line */}
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

      {/* Recent lines toggle */}
      <div className="border-t border-[#242424]/50 pt-2">
        <button
          type="button"
          onClick={() => setRecentOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#888880] transition-colors hover:text-[#F0EDE8]"
        >
          <span
            className={cn(
              'inline-block text-[8px] transition-transform',
              recentOpen ? 'rotate-180' : '',
            )}
          >
            ▾
          </span>
          {recentOpen ? (
            <span>
              Recent{' '}
              <span className="text-[#F0EDE8]/60">
                · {lineCount} line{lineCount !== 1 ? 's' : ''}
              </span>
            </span>
          ) : (
            <span>
              Recent
              {recentItems.length > 0 && (
                <span className="ml-1 text-[#444440]">({recentItems.length})</span>
              )}
            </span>
          )}
        </button>

        {recentOpen && (
          <>
            {recentItems.length > 0 ? (
              <ul
                key={feedBumpKey}
                className="mt-2 flex flex-col gap-2"
                aria-label="Recent lines"
              >
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
            ) : (
              <p className="mt-2 font-mono text-[11px] text-[#444440]">No prior lines.</p>
            )}
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="mt-2 inline-flex w-fit font-mono text-[10px] uppercase tracking-[0.18em] text-[#888880] underline-offset-2 transition-colors hover:text-[#F0EDE8] hover:underline"
            >
              Full history
            </button>
          </>
        )}
      </div>
    </>
  )

  return (
    <>
      {collapsible ? (
        <section className="glass-hud pointer-events-auto w-full rounded-sm border-l-2 border-l-[#C41E3A]/70 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 p-3"
          >
            <div className="flex min-w-0 items-baseline gap-3">
              <h2
                className="shrink-0 text-[20px] font-light italic leading-none tracking-[-0.02em] text-[#F0EDE8]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Dialogue
              </h2>
              {speakerLabel && (
                <span className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-[#888880]">
                  {speakerLabel}
                </span>
              )}
            </div>
            <span
              className={cn(
                'shrink-0 text-[10px] text-[#444440] transition-transform',
                panelOpen && 'rotate-180',
              )}
            >
              ▾
            </span>
          </button>

          {panelOpen && (
            <div className="flex flex-col gap-2.5 px-3 pb-3">
              {content}
            </div>
          )}
        </section>
      ) : (
        <section className="glass-hud pointer-events-auto flex w-full flex-col gap-2.5 rounded-sm border-l-2 border-l-[#C41E3A]/70 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
          {content}
        </section>
      )}

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
