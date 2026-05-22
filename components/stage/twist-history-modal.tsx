'use client'

import { useEffect, useState } from 'react'
import {
  feedItemsFromEvents,
  type FeedItem,
  type StageEventLike,
} from '@/lib/stage/feed-items'

interface Props {
  open: boolean
  onClose: () => void
  stageId: string
  stageName: string
  initialItems: FeedItem[]
}

export function TwistHistoryModal({
  open,
  onClose,
  stageId,
  stageName,
  initialItems,
}: Props) {
  const [items, setItems] = useState<FeedItem[]>(initialItems.filter((i) => i.kind === 'twist'))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setItems(initialItems.filter((i) => i.kind === 'twist'))
    setLoading(true)
    fetch(`/api/v1/stages/${stageId}/history`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { events?: StageEventLike[] } | null) => {
        if (body?.events) {
          setItems(feedItemsFromEvents(body.events).filter((i) => i.kind === 'twist'))
        }
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stageId])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#080808]/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="twist-history-title"
      onClick={onClose}
    >
      <div
        className="glass-hud flex max-h-[min(85vh,720px)] w-full max-w-2xl flex-col rounded-sm border border-[#242424]/80 shadow-[0_30px_80px_rgba(0,0,0,0.75)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#242424]/60 px-5 py-4">
          <div>
            <h2
              id="twist-history-title"
              className="text-[24px] font-light italic leading-none text-[#F0EDE8]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Twist History
            </h2>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#888880]">
              {stageName} · newest first
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#3A3A3A] font-mono text-sm text-[#888880] transition-colors hover:text-[#F0EDE8]"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && items.length === 0 ? (
            <p className="font-mono text-xs text-[#888880]">Loading twists…</p>
          ) : items.length === 0 ? (
            <p className="font-mono text-xs text-[#444440]">No twists yet.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {items.map((item) => {
                if (item.kind !== 'twist') return null
                return (
                  <li key={item.id} className="border-l-2 border-l-[#B8860B]/80 pl-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#B8860B]">
                      {item.userDisplayName}
                    </p>
                    <p
                      className="mt-1 text-[15px] italic leading-snug text-[#F0EDE8]"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      "{item.text}"
                    </p>
                    <time className="mt-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-[#444440]">
                      {new Date(item.createdAt).toLocaleString()}
                    </time>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
