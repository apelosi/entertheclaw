'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

/**
 * Mobile bottom sheet: a portal-mounted panel that rises from the bottom edge,
 * with a scrim, a drag-handle affordance, Esc / backdrop close, and body-scroll
 * lock. Used on the stage page to surface the rail cards (scene, twist, cast)
 * that live in the desktop rail.
 */
export function BottomSheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[#080808]/70 backdrop-blur-sm"
      />
      <div
        className={cn(
          'animate-sheet-rise relative max-h-[85vh] overflow-y-auto rounded-t-xl border-t border-[#242424]/70 bg-[#0c0c0c] px-3 pb-6 pt-3 shadow-[0_-12px_40px_rgba(0,0,0,0.6)]',
        )}
      >
        <div className="mb-2 flex items-center justify-center">
          <div className="h-1 w-9 rounded-full bg-[#3A3A3A]" aria-hidden />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded border border-[#3A3A3A] bg-[#0c0c0c] font-mono text-xs text-[#888880] transition-colors hover:text-[#F0EDE8]"
        >
          ✕
        </button>
        {children}
      </div>
    </div>,
    document.body,
  )
}
