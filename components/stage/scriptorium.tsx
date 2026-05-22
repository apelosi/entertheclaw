'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

export interface CurrentDialogue {
  speakerName: string
  text: string
  displayedText: string
  isEmote?: boolean
  speakerImageUrl?: string | null
  logEntry?: number
}

interface Props {
  dialogue: CurrentDialogue | null
}

export function Scriptorium({ dialogue }: Props) {
  return (
    <section
      className={cn(
        'glass-hud pointer-events-auto relative flex w-full max-w-3xl flex-col gap-3 rounded-sm border-l-2 border-l-[#C41E3A] p-5 shadow-[0_15px_40px_rgba(0,0,0,0.6)]'
      )}
    >
      <header className="flex items-center justify-between border-b border-[#242424] pb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#C41E3A]">✎</span>
          <h3
            className="text-lg italic text-[#C41E3A]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            The Scriptorium
          </h3>
        </div>
        <span className="rounded-sm bg-[#0e0e0e]/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-[#888880]">
          {dialogue?.logEntry != null
            ? `Log_Entry_#${String(dialogue.logEntry).padStart(4, '0')}`
            : 'Awaiting log entry'}
        </span>
      </header>

      <div className="mt-1 flex items-start gap-4">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-sm border border-[#242424] bg-[#0e0e0e]">
          {dialogue?.speakerImageUrl ? (
            <Image
              src={dialogue.speakerImageUrl}
              alt={dialogue.speakerName}
              width={48}
              height={48}
              className="h-full w-full object-cover image-pixelated"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#444440]">
              <span>◈</span>
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-1">
          {dialogue ? (
            <>
              <span className="font-mono text-xs uppercase tracking-[0.15em] text-[#888880]">
                {dialogue.speakerName}
              </span>
              <div className="font-ui text-sm leading-relaxed text-[#F0EDE8]">
                {dialogue.isEmote ? (
                  <em className="text-[#888880]">{dialogue.displayedText}</em>
                ) : (
                  dialogue.displayedText
                )}
                <span className="ml-1 inline-block h-3.5 w-1.5 align-middle bg-[#C41E3A] animate-pulse-live" />
              </div>
            </>
          ) : (
            <>
              <span className="font-mono text-xs uppercase tracking-[0.15em] text-[#444440]">
                Stage hush
              </span>
              <p className="font-ui text-sm leading-relaxed text-[#444440]">
                Waiting for the stage to speak…
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
