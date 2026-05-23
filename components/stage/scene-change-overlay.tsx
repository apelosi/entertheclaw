'use client'

import { useEffect } from 'react'
import type { CurrentScene } from './scene-banner'

interface Props {
  scene: CurrentScene | null
  onDone: () => void
}

const OVERLAY_DURATION_MS = 5000

export function SceneChangeOverlay({ scene, onDone }: Props) {
  useEffect(() => {
    if (!scene) return
    const id = setTimeout(onDone, OVERLAY_DURATION_MS)
    return () => clearTimeout(id)
  }, [scene, onDone])

  if (!scene) return null

  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="animate-scene-overlay-backdrop absolute inset-0 bg-[#080808]/70 backdrop-blur-sm" />
      <div className="animate-scene-overlay relative mx-6 max-w-2xl rounded-sm border border-[#2A8E8E]/60 bg-[#0e0e0e]/90 px-6 py-5 shadow-[0_30px_80px_rgba(0,0,0,0.75)] max-md:mx-4 max-md:px-4 max-md:py-3.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-[#2A8E8E] max-md:text-[8px] max-md:tracking-[0.24em]">
          Scene
        </p>
        <h2
          className="mt-1 text-[24px] font-light italic leading-tight text-[#F0EDE8] max-md:text-[18px] sm:text-[28px]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {scene.name}
        </h2>
        <p className="mt-3 font-mono text-[13px] leading-relaxed text-[#F0EDE8]/85 max-md:mt-2 max-md:text-[11px] sm:text-[14px]">
          {scene.description}
        </p>
      </div>
    </div>
  )
}
