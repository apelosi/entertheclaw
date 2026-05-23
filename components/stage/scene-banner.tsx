'use client'

import { useState } from 'react'
import type { FeedItem } from '@/lib/stage/feed-items'
import { cn } from '@/lib/utils'
import { SceneHistoryModal } from './scene-history-modal'
import { SectionCollapsibleHeader } from './section-collapsible-header'

export interface CurrentScene {
  name: string
  description: string
}

interface Props {
  scene: CurrentScene | null
  stageId: string
  stageName: string
  /** Scene feed items for seeding history while the API loads. */
  recentScenes: FeedItem[]
  defaultOpen?: boolean
}

export function SceneBanner({
  scene,
  stageId,
  stageName,
  recentScenes,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [historyOpen, setHistoryOpen] = useState(false)

  if (!scene) return null

  const sceneHistorySeed = recentScenes.filter((i) => i.kind === 'scene')

  return (
    <>
    <div className="border-b border-[#242424]/50 bg-[#0a0a0a]/40">
      <SectionCollapsibleHeader
        title="Scene"
        meta={scene.name}
        metaTitle={scene.name}
        open={open}
        onClick={() => setOpen((v) => !v)}
        ariaLabelExpanded="Collapse scene"
        ariaLabelCollapsed="Expand scene"
        className="px-3 py-2 transition-colors hover:border-[#3A3A3A]"
      />
      {open && (
        <div className="flex flex-col gap-2 px-3 pb-2">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#F0EDE8]">
            {scene.name}
          </p>
          <p className="font-mono text-[11px] leading-relaxed text-[#888880]">
            {scene.description}
          </p>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex w-fit font-mono text-[10px] uppercase tracking-[0.18em] text-[#888880] underline-offset-2 transition-colors hover:text-[#F0EDE8] hover:underline"
          >
            Scene history
          </button>
        </div>
      )}
    </div>

    <SceneHistoryModal
      open={historyOpen}
      onClose={() => setHistoryOpen(false)}
      stageId={stageId}
      stageName={stageName}
      initialItems={sceneHistorySeed}
    />
    </>
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
      <h2
        className="text-[20px] font-light italic leading-none tracking-[-0.02em] text-[#444440]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Scene
      </h2>
    </div>
  )
}
