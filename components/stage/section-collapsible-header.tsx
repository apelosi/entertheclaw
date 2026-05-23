'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const META_TEXT_CLASS =
  'block truncate text-right font-mono text-[10px] uppercase tracking-[0.18em] text-[#888880]'

const TITLE_CLASS =
  'shrink-0 text-[20px] font-light italic leading-none tracking-[-0.02em] text-[#F0EDE8]'

interface Props {
  title: ReactNode
  titleAs?: 'h2' | 'h3'
  titleClassName?: string
  meta?: ReactNode
  /** Native tooltip for string/number meta (defaults to meta string). */
  metaTitle?: string
  open: boolean
  onClick: () => void
  ariaLabelExpanded: string
  ariaLabelCollapsed: string
  className?: string
}

export function SectionCollapsibleHeader({
  title,
  titleAs: TitleTag = 'h2',
  titleClassName,
  meta,
  metaTitle,
  open,
  onClick,
  ariaLabelExpanded,
  ariaLabelCollapsed,
  className,
}: Props) {
  const metaNode =
    meta == null ? null : typeof meta === 'string' || typeof meta === 'number' ? (
      <span className={META_TEXT_CLASS} title={metaTitle ?? String(meta)}>
        {meta}
      </span>
    ) : (
      <div className="flex min-w-0 justify-end overflow-hidden">{meta}</div>
    )

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden',
        className,
      )}
      aria-expanded={open}
      aria-label={open ? ariaLabelExpanded : ariaLabelCollapsed}
    >
      <TitleTag
        className={cn(TITLE_CLASS, titleClassName)}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {title}
      </TitleTag>
      {metaNode != null ? (
        <div className="min-w-0 overflow-hidden">{metaNode}</div>
      ) : (
        <span className="min-w-0" aria-hidden />
      )}
      <span
        className={cn(
          'shrink-0 text-base leading-none text-[#444440] transition-transform',
          open && 'rotate-180',
        )}
        aria-hidden
      >
        ▾
      </span>
    </button>
  )
}
