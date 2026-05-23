'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { FeedItem } from '@/lib/stage/feed-items'
import { TwistHistoryModal } from './twist-history-modal'

export interface ActiveTwist {
  text: string
  userDisplayName: string
}

interface Props {
  twist: ActiveTwist | null
  recentTwists: FeedItem[]
  twistCount: number
  stageId: string
  stageName: string
  feedBumpKey: number
  /** When true the whole panel can be toggled open/closed (used in mobile stack). */
  collapsible?: boolean
  defaultOpen?: boolean
}

export function TwistPanel({
  twist,
  recentTwists,
  twistCount,
  stageId,
  stageName,
  feedBumpKey,
  collapsible = false,
  defaultOpen = true,
}: Props) {
  const [panelOpen, setPanelOpen] = useState(defaultOpen)
  const [recentOpen, setRecentOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const preview = twist
    ? `"${twist.text.length > 50 ? twist.text.slice(0, 50) + '…' : twist.text}"`
    : 'No twist yet'

  return (
    <>
      <section
        className={cn(
          'glass-hud pointer-events-auto w-full rounded-sm border-l-2 border-l-[#B8860B]/70 shadow-[0_12px_40px_rgba(0,0,0,0.45)]',
          collapsible ? '' : 'flex flex-col gap-2 p-3',
        )}
      >
        {collapsible ? (
          <>
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
                  Twist
                </h2>
                {!panelOpen && (
                  <span className="truncate font-mono text-[10px] italic text-[#888880]">
                    {preview}
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
              <div className="flex flex-col gap-2 px-3 pb-3">
                <TwistContent
                  twist={twist}
                  recentTwists={recentTwists}
                  twistCount={twistCount}
                  feedBumpKey={feedBumpKey}
                  recentOpen={recentOpen}
                  onToggleRecent={() => setRecentOpen((v) => !v)}
                  onOpenHistory={() => setHistoryOpen(true)}
                />
              </div>
            )}
          </>
        ) : (
          <TwistContent
            twist={twist}
            recentTwists={recentTwists}
            twistCount={twistCount}
            feedBumpKey={feedBumpKey}
            recentOpen={recentOpen}
            onToggleRecent={() => setRecentOpen((v) => !v)}
            onOpenHistory={() => setHistoryOpen(true)}
          />
        )}
      </section>

      <TwistHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        stageId={stageId}
        stageName={stageName}
        initialItems={recentTwists}
      />
    </>
  )
}

function TwistContent({
  twist,
  recentTwists,
  twistCount,
  feedBumpKey,
  recentOpen,
  onToggleRecent,
  onOpenHistory,
}: {
  twist: ActiveTwist | null
  recentTwists: FeedItem[]
  twistCount: number
  feedBumpKey: number
  recentOpen: boolean
  onToggleRecent: () => void
  onOpenHistory: () => void
}) {
  return (
    <>
      <h2
        className="text-[20px] font-light italic leading-none tracking-[-0.02em] text-[#F0EDE8]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Twist
      </h2>

      {twist ? (
        <>
          <p
            className="text-[17px] italic leading-snug text-[#F0EDE8]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            "{twist.text}"
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#888880]">
            — {twist.userDisplayName}
          </p>
        </>
      ) : (
        <p className="font-mono text-[12px] leading-relaxed text-[#444440]">
          No twist on stage yet.
        </p>
      )}

      {/* Recent twists toggle */}
      <div className="border-t border-[#242424]/50 pt-2">
        <button
          type="button"
          onClick={onToggleRecent}
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
                · {twistCount} twist{twistCount !== 1 ? 's' : ''}
              </span>
            </span>
          ) : (
            <span>
              Recent
              {recentTwists.length > 0 && (
                <span className="ml-1 text-[#444440]">({recentTwists.length})</span>
              )}
            </span>
          )}
        </button>

        {recentOpen && (
          <>
            {recentTwists.length > 0 ? (
              <ul
                key={feedBumpKey}
                className="mt-2 flex flex-col gap-2"
                aria-label="Recent twists"
              >
                {recentTwists.map((item, index) => {
                  if (item.kind !== 'twist') return null
                  return (
                    <li
                      key={item.id}
                      className="stage-feed-enter font-mono text-[11px] italic leading-relaxed text-[#B8860B]/90"
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <span className="not-italic text-[#888880]">{item.userDisplayName}:</span>{' '}
                      "{item.text}"
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="mt-2 font-mono text-[11px] text-[#444440]">No prior twists.</p>
            )}
            <button
              type="button"
              onClick={onOpenHistory}
              className="mt-2 inline-flex w-fit font-mono text-[10px] uppercase tracking-[0.18em] text-[#888880] underline-offset-2 transition-colors hover:text-[#F0EDE8] hover:underline"
            >
              Full history
            </button>
          </>
        )}
      </div>
    </>
  )
}
