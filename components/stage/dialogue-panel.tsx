'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { FeedItem } from '@/lib/stage/feed-items'
import { cn } from '@/lib/utils'
import { DialogueHistoryModal } from './dialogue-history-modal'
import { SceneBanner, type CurrentScene } from './scene-banner'
import { SectionCollapsibleHeader } from './section-collapsible-header'

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

function useRecentScriptLimit() {
  const [limit, setLimit] = useState(RECENT_SCRIPT_LIMIT_DESKTOP)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const update = () =>
      setLimit(mq.matches ? RECENT_SCRIPT_LIMIT_MOBILE : RECENT_SCRIPT_LIMIT_DESKTOP)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return limit
}

function CurrentSpeakerMeta({ speakerName }: { speakerName: string }) {
  return (
    <span
      className="flex min-w-0 items-center justify-end gap-1.5 truncate font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#C41E3A]"
      title={speakerName}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#C41E3A] shadow-[0_0_6px_rgba(196,30,58,0.8)] animate-pulse"
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
  const recentLimit = useRecentScriptLimit()
  const visibleRecentItems = recentItems.slice(0, recentLimit)

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
          className="border-t border-[#242424]/50 px-3 py-2 transition-colors hover:border-[#3A3A3A]"
        />

        {scriptOpen && (
          <div className="flex flex-col gap-2.5 px-3 pb-3">
            <div className="flex items-start gap-2.5 border-l-2 border-l-[#C41E3A]/70 pl-2">
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-sm bg-[#0e0e0e]/70 ring-1 ring-[#242424]/60">
                {dialogue?.speakerImageUrl ? (
                  <Image
                    src={dialogue.speakerImageUrl}
                    alt={dialogue.speakerName}
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
              <div className="min-h-[2.5rem] min-w-0 flex-1">
                {dialogue ? (
                  <>
                    <p className="mb-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#C41E3A]">
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

            {visibleRecentItems.length > 0 ? (
              <ul
                key={feedBumpKey}
                className="flex flex-col gap-2.5"
                aria-label="Recent script entries"
              >
                {visibleRecentItems.map((item, index) => {
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
              !dialogue && (
                <p className="font-mono text-[11px] text-[#444440]">No prior script entries.</p>
              )
            )}
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="inline-flex w-fit font-mono text-[10px] uppercase tracking-[0.18em] text-[#888880] underline-offset-2 transition-colors hover:text-[#F0EDE8] hover:underline"
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
