'use client'

import { useEffect, useRef } from 'react'

interface Props {
  description: string | null
  theme: string
  themeLabel: string
  createdAt: string | null
  open: boolean
  onClose: () => void
}

export function StageAboutPanel({ description, theme: _theme, themeLabel, createdAt, open, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    const t = setTimeout(() => window.addEventListener('mousedown', onClick), 0)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
      clearTimeout(t)
    }
  }, [open, onClose])

  if (!open) return null

  const formattedDate = createdAt
    ? new Date(createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-label="About this stage"
      className="glass-hud pointer-events-auto absolute left-1/2 top-[4rem] z-40 w-[min(36rem,calc(100%-2.5rem))] max-h-[min(70vh,calc(100dvh-5rem))] -translate-x-1/2 overflow-y-auto overscroll-contain rounded-sm border-l-2 border-l-[#C41E3A]/70 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.55)] max-md:top-[3.25rem] max-md:p-3"
    >
      <header className="mb-3 flex items-center justify-between gap-3 max-md:mb-2 max-md:gap-2">
        <h3
          className="text-[18px] font-light italic leading-none tracking-[-0.02em] text-[#F0EDE8] max-md:text-[15px]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          About this stage
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#3A3A3A] font-mono text-sm text-[#888880] transition-colors hover:text-[#F0EDE8] max-md:h-6 max-md:w-6 max-md:text-xs"
        >
          ×
        </button>
      </header>

      <dl className="mb-3 flex flex-wrap gap-x-6 gap-y-1 max-md:mb-2 max-md:gap-x-4">
        <div className="flex items-baseline gap-2 max-md:gap-1.5">
          <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#444440] max-md:text-[8px]">Theme</dt>
          <dd className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#888880] max-md:text-[9px]">{themeLabel}</dd>
        </div>
        {formattedDate && (
          <div className="flex items-baseline gap-2 max-md:gap-1.5">
            <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#444440] max-md:text-[8px]">Created</dt>
            <dd className="font-mono text-[11px] text-[#888880] max-md:text-[9px]">{formattedDate}</dd>
          </div>
        )}
      </dl>

      {description ? (
        <p className="font-mono text-[12px] leading-relaxed text-[#F0EDE8]/90 max-md:text-[10px]">
          {description}
        </p>
      ) : (
        <p className="font-mono text-[12px] leading-relaxed text-[#444440] max-md:text-[10px]">
          No description for this stage yet.
        </p>
      )}
    </div>
  )
}
