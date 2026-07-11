'use client'

import { cn } from '@/lib/utils'
import {
  MONO_BODY_SM,
  MONO_LABEL,
  PANEL_COLLAPSIBLE_INSET,
  PANEL_STACK_GAP,
  SECTION_HEADER_GAP,
  SECTION_TITLE,
} from './stage-mobile-classes'

export interface CurrentScene {
  name: string
  description: string
}

/**
 * Current scene, as a rail card (desktop) or sheet body (mobile, `bare`).
 * History moved to the unified stage feed, so there's no history link here.
 */
export function SceneCard({
  scene,
  bare = false,
}: {
  scene: CurrentScene | null
  bare?: boolean
}) {
  const content = (
    <>
      <header className={cn('flex items-center', SECTION_HEADER_GAP)}>
        <h2 className={SECTION_TITLE} style={{ fontFamily: 'var(--font-display)' }}>
          Scene
        </h2>
      </header>
      {scene ? (
        <div className="flex flex-col gap-1">
          <p className={cn(MONO_LABEL, 'text-[#2A8E8E]')}>{scene.name}</p>
          <p className={cn(MONO_BODY_SM, 'leading-relaxed text-[#888880]')}>
            {scene.description}
          </p>
        </div>
      ) : (
        <p className={cn(MONO_BODY_SM, 'text-[#444440]')}>The scene is still being set.</p>
      )}
    </>
  )

  if (bare) {
    return <div className={cn('flex flex-col', PANEL_STACK_GAP)}>{content}</div>
  }

  return (
    <section
      className={cn(
        'glass-hud pointer-events-auto flex w-full flex-col rounded-sm border-l-2 border-l-[#2A8E8E]/70 shadow-[0_12px_40px_rgba(0,0,0,0.45)]',
        PANEL_STACK_GAP,
        PANEL_COLLAPSIBLE_INSET,
      )}
    >
      {content}
    </section>
  )
}
