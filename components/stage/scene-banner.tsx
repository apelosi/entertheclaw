'use client'

import { cn } from '@/lib/utils'

export interface CurrentScene {
  name: string
  description: string
}

interface Props {
  scene: CurrentScene | null
}

export function SceneBanner({ scene }: Props) {
  if (!scene) return null

  return (
    <div className="border-b border-[#242424]/50 bg-[#0a0a0a]/40 px-3 py-2">
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
      <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-[#888880]">
        {scene.description}
      </p>
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
