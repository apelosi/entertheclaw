'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { MONO_BODY_SM } from './stage-mobile-classes'

const DIVIDER_EDGE = 'text-[#444440]/80'

const MARKER_BASE =
  'text-center font-mono text-[10px] tracking-[0.12em] max-md:text-[8px] max-md:tracking-[0.1em]'

function TimelineDivider({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p className={cn(MARKER_BASE, className)}>
      <span className={DIVIDER_EDGE} aria-hidden>
        ──{' '}
      </span>
      {children}
      <span className={DIVIDER_EDGE} aria-hidden>
        {' '}
        ──
      </span>
    </p>
  )
}

export function SceneScriptMarker({
  name,
  description,
  className,
}: {
  name: string
  description: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <TimelineDivider className="uppercase text-[#2A8E8E]">Scene · {name}</TimelineDivider>
      {description ? (
        <p className={cn(MONO_BODY_SM, 'px-2 text-center text-[#888880]')}>{description}</p>
      ) : null}
    </div>
  )
}

export function TwistScriptMarker({
  userDisplayName,
  text,
  className,
}: {
  userDisplayName: string
  text: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <TimelineDivider className="uppercase text-[#B8860B]/90">
        Twist · {userDisplayName}
      </TimelineDivider>
      <p
        className="px-2 text-center text-[13px] italic leading-snug text-[#B8860B]/90 max-md:text-[11px]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        &ldquo;{text}&rdquo;
      </p>
    </div>
  )
}
