'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { StageFeed, type CurrentLine } from './stage-feed'
import type { StageFeedController } from './use-stage-feed'
import {
  LINK_MICRO,
  LIVE_DOT,
  MONO_LABEL,
  PANEL_INSET,
  PANEL_STACK_GAP,
  SECTION_HEADER_GAP,
  SECTION_TITLE,
} from './stage-mobile-classes'

interface Props {
  stageId: string
  feed: StageFeedController
  currentLine: CurrentLine | null
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

export function DialoguePanel({ stageId, feed, currentLine, speakerImageByName }: Props) {
  return (
    <section className="glass-hud pointer-events-auto flex w-full flex-col rounded-sm border-l-2 border-l-[#C41E3A]/70 shadow-[0_12px_40px_rgba(0,0,0,0.45)] lg:h-full">
      <header
        className={cn(
          'flex items-center border-b border-[#242424]/50 px-3 py-2 max-md:px-2 max-md:py-1.5',
          SECTION_HEADER_GAP,
        )}
      >
        <h2 className={SECTION_TITLE} style={{ fontFamily: 'var(--font-display)' }}>
          Script
        </h2>
        <div className="flex min-w-0 flex-1 justify-end">
          {currentLine ? <CurrentSpeakerMeta speakerName={currentLine.speakerName} /> : null}
        </div>
      </header>

      <div className={cn('flex flex-col', PANEL_STACK_GAP, PANEL_INSET, 'pt-2', 'lg:min-h-0 lg:flex-1')}>
        <StageFeed
          feed={feed}
          currentLine={currentLine}
          speakerImageByName={speakerImageByName}
          variant="panel"
        />
        <Link
          href={`/stage/${stageId}/history`}
          className={cn(
            LINK_MICRO,
            'inline-flex w-fit text-[#888880] underline-offset-2 transition-colors hover:text-[#F0EDE8] hover:underline',
          )}
        >
          Full stage history
        </Link>
      </div>
    </section>
  )
}
