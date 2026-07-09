'use client'

import { useState } from 'react'
import type { FeedItem } from '@/lib/stage/feed-items'
import { cn } from '@/lib/utils'
import { DialogueHistoryModal } from './dialogue-history-modal'
import { SceneBanner, type CurrentScene } from './scene-banner'
import { SectionCollapsibleHeader } from './section-collapsible-header'
import { StageFeed, type CurrentLine } from './stage-feed'
import type { StageFeedController } from './use-stage-feed'
import {
  LINK_MICRO,
  LIVE_DOT,
  MONO_LABEL,
  PANEL_HEADER_INSET,
  PANEL_INSET,
  PANEL_STACK_GAP,
} from './stage-mobile-classes'

interface Props {
  stageId: string
  stageName: string
  feed: StageFeedController
  currentLine: CurrentLine | null
  allHistoryItems: FeedItem[]
  currentScene: CurrentScene | null
  recentScenes: FeedItem[]
  speakerImageByName: Map<string, string | null>
}

function CurrentSpeakerMeta({ speakerName }: { speakerName: string }) {
  return (
    <span
      className={cn(
        'flex min-w-0 items-center justify-end gap-1.5 truncate font-medium text-[#C41E3A]',
        MONO_LABEL,
      )}
      title={speakerName}
    >
      <span
        className={cn(
          LIVE_DOT,
          'rounded-full bg-[#C41E3A] shadow-[0_0_6px_rgba(196,30,58,0.8)] animate-pulse',
        )}
        aria-hidden
      />
      <span className="truncate">{speakerName}</span>
    </span>
  )
}

export function DialoguePanel({
  stageId,
  stageName,
  feed,
  currentLine,
  allHistoryItems,
  currentScene,
  recentScenes,
  speakerImageByName,
}: Props) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const [scriptOpen, setScriptOpen] = useState(true)

  return (
    <>
      <section className="glass-hud pointer-events-auto w-full rounded-sm border-l-2 border-l-[#C41E3A]/70 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        <SceneBanner
          scene={currentScene}
          stageId={stageId}
          stageName={stageName}
          recentScenes={recentScenes}
        />

        <SectionCollapsibleHeader
          title="Script"
          meta={
            currentLine ? (
              <CurrentSpeakerMeta speakerName={currentLine.speakerName} />
            ) : undefined
          }
          open={scriptOpen}
          onClick={() => setScriptOpen((v) => !v)}
          ariaLabelExpanded="Collapse script"
          ariaLabelCollapsed="Expand script"
          className={cn(
            'border-t border-[#242424]/50 transition-colors hover:border-[#3A3A3A]',
            PANEL_HEADER_INSET,
          )}
        />

        {scriptOpen && (
          <div className={cn('flex flex-col', PANEL_STACK_GAP, PANEL_INSET)}>
            <StageFeed
              feed={feed}
              currentLine={currentLine}
              speakerImageByName={speakerImageByName}
              variant="panel"
            />
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className={cn(
                LINK_MICRO,
                'inline-flex w-fit text-[#888880] underline-offset-2 transition-colors hover:text-[#F0EDE8] hover:underline',
              )}
            >
              Script history
            </button>
          </div>
        )}
      </section>

      <DialogueHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        stageId={stageId}
        stageName={stageName}
        initialItems={allHistoryItems}
      />
    </>
  )
}
