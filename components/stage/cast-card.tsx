'use client'

import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { characterDetailPath, agentInvitePathForStage } from '@/lib/paths'
import {
  MONO_LABEL,
  PANEL_COLLAPSIBLE_INSET,
  PANEL_STACK_GAP,
  SECTION_HEADER_GAP,
  SECTION_TITLE,
} from './stage-mobile-classes'

export interface RailCharacter {
  participantId: string
  agentId: string
  characterId: string | null
  role: string
  characterName: string | null
  characterImageUrl: string | null
  /** Whether the current viewer owns this agent. */
  isMine: boolean
}

interface Props {
  stageId: string
  mainCharacters: RailCharacter[]
  activeAgentId: string | null
  maxSlots?: number
  bare?: boolean
}

/** Legend explaining the two avatar indicators — kept next to the cast grid. */
export function IndicatorLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#888880]',
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block h-2 w-2 rounded-full bg-[#C41E3A] animate-speaker-glow"
          aria-hidden
        />
        Speaking now
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block h-2 w-2 rounded-sm ring-2 ring-[#B8860B]"
          aria-hidden
        />
        Your character
      </span>
    </div>
  )
}

export function CastCard({
  stageId,
  mainCharacters,
  activeAgentId,
  maxSlots = 12,
  bare = false,
}: Props) {
  const slots: (RailCharacter | null)[] = Array.from(
    { length: maxSlots },
    (_, i) => mainCharacters[i] ?? null,
  )
  const activeCount = mainCharacters.length
  const countLabel = `${String(activeCount).padStart(2, '0')}/${String(maxSlots).padStart(2, '0')}`
  const hasMine = mainCharacters.some((c) => c.isMine)

  const content = (
    <>
      <header className={cn('flex items-center', SECTION_HEADER_GAP)}>
        <h2 className={SECTION_TITLE} style={{ fontFamily: 'var(--font-display)' }}>
          Cast
        </h2>
        <span className={cn('min-w-0 flex-1 truncate text-right', MONO_LABEL)}>{countLabel}</span>
      </header>

      <div className="grid grid-cols-4 gap-1.5 max-md:gap-1">
        {slots.map((char, i) => {
          if (!char) {
            return (
              <div key={`empty-${i}`} className="aspect-square rounded-sm bg-[#111111]/40" aria-hidden />
            )
          }

          const isActive = char.agentId === activeAgentId
          const title = char.isMine
            ? `${char.characterName ?? 'Your character'} — your character, view profile`
            : isActive
              ? `${char.characterName ?? 'Character'} — speaking now`
              : (char.characterName ?? 'Character')

          // Border = ownership (gold, persistent). Motion = active speaker
          // (pulsing glow), so the two never compete for the same channel.
          const tileClass = cn(
            'group relative aspect-square overflow-hidden rounded-sm bg-[#0e0e0e] transition-all',
            char.isMine
              ? 'ring-2 max-md:ring-1 ring-[#B8860B]'
              : 'ring-1 ring-[#242424]/60 hover:ring-[#3A3A3A]',
            isActive && 'animate-speaker-glow',
          )

          const tileContent = (
            <>
              {char.characterImageUrl ? (
                <Image
                  src={char.characterImageUrl}
                  alt={char.characterName ?? 'Character'}
                  fill
                  sizes="56px"
                  className={cn(
                    'object-cover image-pixelated transition-opacity',
                    isActive ? 'opacity-100' : 'opacity-75 group-hover:opacity-100',
                  )}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#1a1a1a]">
                  <span className="text-lg max-md:text-sm text-[#444440]">◈</span>
                </div>
              )}
              {char.isMine && (
                <span
                  className="absolute right-1 top-1 max-md:right-0.5 max-md:top-0.5 rounded-sm bg-[#B8860B] px-1 font-mono text-[7px] font-medium uppercase leading-[1.4] tracking-[0.1em] text-[#080808]"
                  aria-label="Your character"
                >
                  You
                </span>
              )}
            </>
          )

          if (!char.characterId) {
            return (
              <div key={char.participantId} title={title} className={tileClass}>
                {tileContent}
              </div>
            )
          }

          return (
            <Link
              key={char.participantId}
              href={characterDetailPath(char.characterId)}
              title={title}
              className={tileClass}
            >
              {tileContent}
            </Link>
          )
        })}
      </div>

      {/* Native anchor (not Link) so the tap always navigates — see stage-action-bar. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href={agentInvitePathForStage(stageId)}
        className={cn(
          'inline-flex h-10 w-full items-center justify-center gap-2 rounded-sm bg-[#C41E3A] px-4 font-mono text-xs font-medium uppercase tracking-[0.15em] text-[#F0EDE8] transition-all max-md:h-9 max-md:px-3 max-md:text-[11px]',
          'hover:bg-[#9B1B30] hover:shadow-[0_0_18px_rgba(196,30,58,0.35)]',
        )}
      >
        <span aria-hidden>+</span> Invite an Agent
      </a>

      {(hasMine || activeAgentId) && <IndicatorLegend className="pt-0.5" />}
    </>
  )

  if (bare) {
    return <div className={cn('flex flex-col', PANEL_STACK_GAP)}>{content}</div>
  }

  return (
    <aside
      className={cn(
        'glass-hud pointer-events-auto flex w-full flex-col rounded-sm border-l-2 border-l-[#C41E3A]/70 shadow-[0_12px_40px_rgba(0,0,0,0.45)]',
        PANEL_STACK_GAP,
        PANEL_COLLAPSIBLE_INSET,
      )}
    >
      {content}
    </aside>
  )
}
