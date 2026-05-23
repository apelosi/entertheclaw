'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  SECTION_CHEVRON,
  SECTION_HEADER_GAP,
  SECTION_META,
  SECTION_TITLE,
} from './stage-mobile-classes'

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
      <span className={SECTION_META} title={metaTitle ?? String(meta)}>
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
        'grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center overflow-hidden',
        SECTION_HEADER_GAP,
        className,
      )}
      aria-expanded={open}
      aria-label={open ? ariaLabelExpanded : ariaLabelCollapsed}
    >
      <TitleTag
        className={cn(SECTION_TITLE, titleClassName)}
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
        className={cn(SECTION_CHEVRON, open && 'rotate-180')}
        aria-hidden
      >
        ▾
      </span>
    </button>
  )
}
