'use client'

import Image from 'next/image'

export interface CurrentDialogue {
  speakerName: string
  text: string
  displayedText: string
  isEmote?: boolean
  speakerImageUrl?: string | null
}

interface Props {
  dialogue: CurrentDialogue | null
}

export function DialoguePanel({ dialogue }: Props) {
  return (
    <section className="pointer-events-auto w-full max-w-3xl border-l-2 border-l-[#C41E3A]/70 pl-4">
      <header className="mb-2 flex items-baseline justify-between gap-3">
        <h3
          className="text-[22px] font-light italic leading-none tracking-[-0.02em] text-[#F0EDE8]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Dialogue
        </h3>
        {dialogue && (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#C41E3A]">
            {dialogue.speakerName}
          </span>
        )}
      </header>

      <div className="flex items-start gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-sm bg-[#0e0e0e]/70 ring-1 ring-[#242424]/60">
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

        <div className="min-h-[3rem] flex-1">
          {dialogue ? (
            <p className="font-mono text-[13px] leading-relaxed text-[#F0EDE8]">
              {dialogue.isEmote ? (
                <em className="text-[#888880]">{dialogue.displayedText}</em>
              ) : (
                dialogue.displayedText
              )}
              <span className="ml-1 inline-block h-3.5 w-1.5 align-middle bg-[#C41E3A] animate-pulse-live" />
            </p>
          ) : (
            <p className="font-mono text-[13px] leading-relaxed text-[#444440]">
              Waiting for the stage to speak…
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
