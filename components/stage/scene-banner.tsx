'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface CurrentScene {
  name: string
  description: string
}

interface Props {
  scene: CurrentScene | null
}

export function SceneBanner({ scene }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (!scene) return null

  return (
    <div className="border-b border-[#242424]/50 bg-[#0a0a0a]/40 px-3 py-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#2A8E8E]">
              Scene
            </span>
            <span
              className="truncate text-[13px] italic leading-tight text-[#F0EDE8]/90"
              style={{ fontFamily: 'var(--font-display)' }}
              title={scene.name}
            >
              {scene.name}
            </span>
          </div>
          {expanded && (
            <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-[#888880]">
              {scene.description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="shrink-0 font-mono text-[9px] uppercase tracking-[0.18em] text-[#888880] underline-offset-2 transition-colors hover:text-[#F0EDE8] hover:underline"
        >
          {expanded ? (
            <span>
              Show less <span className="ml-0.5">▴</span>
            </span>
          ) : (
            <span>
              Show all <span className="ml-0.5">▾</span>
            </span>
          )}
        </button>
      </div>
    </div>
  )
}

export function SceneBannerSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'border-b border-[#242424]/40 bg-[#0a0a0a]/30 px-3 py-2',
        className,
      )}
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#444440]">
        No scene yet
      </span>
    </div>
  )
}
