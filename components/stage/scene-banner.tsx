'use client'

import { useState } from 'react'
import type { FeedItem } from '@/lib/stage/feed-items'
import { cn } from '@/lib/utils'
import { SceneHistoryModal } from './scene-history-modal'
import { SectionCollapsibleHeader } from './section-collapsible-header'
import {
  LINK_MICRO,
  MONO_BODY_SM,
  MONO_LABEL,
  PANEL_HEADER_INSET,
  PANEL_INSET,
  SECTION_TITLE,
} from './stage-mobile-classes'

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
          open={open}
          onClick={() => setOpen((v) => !v)}
          ariaLabelExpanded="Collapse scene"
          ariaLabelCollapsed="Expand scene"
          className={cn(PANEL_HEADER_INSET, 'transition-colors hover:border-[#3A3A3A]')}
        />
        <div className={cn('flex flex-col gap-1 border-t border-[#242424]/30', PANEL_INSET, 'pt-2')}>
          <p className={cn(MONO_LABEL, 'text-[#2A8E8E]')}>{scene.name}</p>
          <p
            className={cn(
              MONO_BODY_SM,
              'text-[#888880]',
              open ? 'leading-relaxed' : 'line-clamp-2 lg:line-clamp-1',
            )}
            title={open ? undefined : scene.description}
          >
            {scene.description}
          </p>
          {open && (
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className={cn(
                LINK_MICRO,
                'mt-1 inline-flex w-fit text-[#888880] underline-offset-2 transition-colors hover:text-[#F0EDE8] hover:underline',
              )}
            >
              Scene history
            </button>
          )}
        </div>
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
        'border-b border-[#242424]/40 bg-[#0a0a0a]/30',
        PANEL_HEADER_INSET,
        className,
      )}
    >
      <h2
        className={cn(SECTION_TITLE, 'text-[#444440]')}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Scene
      </h2>
    </div>
  )
}
