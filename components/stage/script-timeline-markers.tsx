'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { MONO_BODY_SM } from './stage-mobile-classes'

const TWIST_PREVIEW_LEN = 60

function twistPreview(text: string): string {
  if (text.length <= TWIST_PREVIEW_LEN) return text
  return `${text.slice(0, TWIST_PREVIEW_LEN).trimEnd()}…`
}

const DIVIDER_EDGE = 'text-[#444440]/80'

const MARKER_BASE =
  'text-center font-mono text-[10px] tracking-[0.12em] max-md:text-[8px] max-md:tracking-[0.1em]'

function TimelineDivider({
  children,
  className,
  title,
}: {
  children: ReactNode
  className?: string
  title?: string
}) {
  return (
    <p className={cn(MARKER_BASE, className)} title={title}>
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
    <TimelineDivider
      className={cn('uppercase text-[#2A8E8E]', className)}
      title={description}
    >
      Scene · {name}
    </TimelineDivider>
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
  const preview = twistPreview(text)
  return (
    <TimelineDivider className={cn('text-[#B8860B]/90', className)} title={text}>
      <span className="uppercase text-[#888880]">Twist · {userDisplayName}</span>
      <span className={cn('ml-1 italic normal-case', MONO_BODY_SM)}>
        &ldquo;{preview}&rdquo;
      </span>
    </TimelineDivider>
  )
}
