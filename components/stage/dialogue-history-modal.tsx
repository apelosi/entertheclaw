'use client'

import { useCallback, useEffect, useState } from 'react'
import { CopyButton } from '@/components/ui/copy-button'
import {
  feedItemsFromEvents,
  formatFeedAsMarkdown,
  type FeedItem,
  type StageEventLike,
} from '@/lib/stage/feed-items'
import { normalizeEmoteAction } from '@/lib/stage/dialogue-format'
import { cn } from '@/lib/utils'
import { DialogueText } from './dialogue-text'
import {
  MODAL_BODY,
  MODAL_CLOSE_BTN,
  MODAL_HEADER,
  MODAL_LIST_GAP,
  MODAL_SHELL,
  MODAL_SUBTITLE,
  MODAL_TITLE,
  MONO_BODY,
  MONO_BODY_SM,
  MONO_LABEL,
} from './stage-mobile-classes'

interface Props {
  open: boolean
  onClose: () => void
  stageId: string
  stageName: string
  /** Seed while loading full history from API. */
  initialItems: FeedItem[]
}

export function DialogueHistoryModal({
  open,
  onClose,
  stageId,
  stageName,
  initialItems,
}: Props) {
  const [items, setItems] = useState<FeedItem[]>(initialItems)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setItems(initialItems)
    setLoading(true)
    fetch(`/api/v1/stages/${stageId}/history`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { events?: StageEventLike[] } | null) => {
        if (body?.events) {
          setItems(feedItemsFromEvents(body.events))
        }
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once per open
  }, [open, stageId])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const markdown = formatFeedAsMarkdown(items, stageName)

  const downloadMd = useCallback(() => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${stageName.replace(/\s+/g, '-').toLowerCase()}-script.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [markdown, stageName])

  if (!open) return null

  return (
    <div
      className={MODAL_SHELL}
      role="dialog"
      aria-modal="true"
      aria-labelledby="script-history-title"
      onClick={onClose}
    >
      <div
        className="glass-hud flex max-h-[min(85vh,720px)] w-full max-w-2xl flex-col rounded-sm border border-[#242424]/80 shadow-[0_30px_80px_rgba(0,0,0,0.75)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={MODAL_HEADER}>
          <div>
            <h2
              id="script-history-title"
              className={MODAL_TITLE}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Script History
            </h2>
            <p className={MODAL_SUBTITLE}>
              {stageName} · newest first
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 max-md:gap-1.5">
            <CopyButton text={markdown} label="Copy script" />
            <button
              type="button"
              onClick={downloadMd}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-[#3A3A3A] px-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#888880] transition-colors hover:border-[#444440] hover:bg-[#161616] hover:text-[#F0EDE8] max-md:h-7 max-md:px-2 max-md:text-[8px]"
            >
              .md
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={MODAL_CLOSE_BTN}
            >
              ×
            </button>
          </div>
        </header>

        <div className={MODAL_BODY}>
          {loading && items.length === 0 ? (
            <p className="font-mono text-xs text-[#888880] max-md:text-[11px]">Loading history…</p>
          ) : items.length === 0 ? (
            <p className="font-mono text-xs text-[#444440] max-md:text-[11px]">No script entries yet.</p>
          ) : (
            <ul className={MODAL_LIST_GAP}>
              {items.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    'border-l-2 pl-3 max-md:pl-2',
                    item.kind === 'twist'
                      ? 'border-l-[#B8860B]/80'
                      : item.kind === 'scene'
                        ? 'border-l-[#2A8E8E]/80'
                        : 'border-l-[#C41E3A]/50',
                  )}
                >
                  {item.kind === 'dialogue' ? (
                    <>
                      <p className={cn(MONO_LABEL, 'tracking-[0.15em] text-[#C41E3A]')}>
                        {item.speakerName}
                      </p>
                      <p className={cn('mt-1 text-[#F0EDE8]', MONO_BODY)}>
                        {item.isEmote ? (
                          <em className="text-[#888880]">{normalizeEmoteAction(item.text)}</em>
                        ) : (
                          <DialogueText text={item.text} className="text-[#F0EDE8]" />
                        )}
                      </p>
                    </>
                  ) : item.kind === 'scene' ? (
                    <>
                      <p className={cn(MONO_LABEL, 'tracking-[0.15em] text-[#2A8E8E]')}>
                        Scene · {item.name}
                      </p>
                      <p className={cn('mt-1 italic text-[#F0EDE8]/85', MONO_BODY_SM)}>
                        {item.description}
                      </p>
                      {item.reason && (
                        <p className={cn('mt-1 text-[#888880]', MONO_LABEL)}>
                          {item.reason}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className={cn(MONO_LABEL, 'tracking-[0.15em] text-[#B8860B]')}>
                        Twist · {item.userDisplayName}
                      </p>
                      <p
                        className="mt-1 text-[15px] italic leading-snug text-[#F0EDE8] max-md:text-[13px]"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        “{item.text}”
                      </p>
                    </>
                  )}
                  <time className="mt-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-[#444440] max-md:text-[8px]">
                    {new Date(item.createdAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
