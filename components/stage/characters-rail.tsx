'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { characterDetailPath, agentInvitePathForStage } from '@/lib/paths'
import { SectionCollapsibleHeader } from './section-collapsible-header'
import {
  LINK_MICRO,
  MONO_LABEL,
  PANEL_COLLAPSIBLE_INSET,
  PANEL_INSET,
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
  /** When true the whole panel can be toggled open/closed (used in mobile stack). */
  collapsible?: boolean
  defaultOpen?: boolean
}

export function CharactersRail({
  stageId,
  mainCharacters,
  activeAgentId,
  maxSlots = 12,
  collapsible = false,
  defaultOpen = true,
}: Props) {
  const [panelOpen, setPanelOpen] = useState(defaultOpen)

  const slots: (RailCharacter | null)[] = Array.from(
    { length: maxSlots },
    (_, i) => mainCharacters[i] ?? null,
  )
  const activeCount = mainCharacters.length

  const countLabel = `${String(activeCount).padStart(2, '0')}/${String(maxSlots).padStart(2, '0')}`

  const grid = (
    <div className="grid grid-cols-4 gap-1.5 max-md:gap-1">
      {slots.map((char, i) => {
        if (!char) {
          return (
            <div
              key={`empty-${i}`}
              className="aspect-square rounded-sm bg-[#111111]/40"
              aria-hidden
            />
          )
        }

        const isActive = char.agentId === activeAgentId
        const title = char.isMine
          ? `${char.characterName ?? 'Your character'} — view profile`
          : (char.characterName ?? 'Character')

        const tileClass = cn(
          'group relative aspect-square overflow-hidden rounded-sm bg-[#0e0e0e] transition-all',
          isActive &&
            'ring-2 max-md:ring-1 ring-[#C41E3A] shadow-[0_0_18px_rgba(196,30,58,0.45)] max-md:shadow-[0_0_10px_rgba(196,30,58,0.45)]',
          char.isMine && !isActive && 'ring-2 max-md:ring-1 ring-[#B8860B]',
          !char.isMine && !isActive && 'ring-1 ring-[#242424]/60 hover:ring-[#3A3A3A]',
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
                className="absolute right-1 top-1 max-md:right-0.5 max-md:top-0.5 inline-block h-1.5 w-1.5 max-md:h-1 max-md:w-1 rounded-full bg-[#B8860B] shadow-[0_0_6px_#B8860B]"
                aria-label="Your agent"
              />
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
  )

  if (collapsible) {
    return (
      <aside className="glass-hud pointer-events-auto w-full rounded-sm border-l-2 border-l-[#C41E3A]/70 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        <SectionCollapsibleHeader
          title="Characters"
          meta={countLabel}
          open={panelOpen}
          onClick={() => setPanelOpen((v) => !v)}
          ariaLabelExpanded="Collapse characters"
          ariaLabelCollapsed="Expand characters"
          className={PANEL_COLLAPSIBLE_INSET}
        />

        {panelOpen && (
          <div className={cn('flex flex-col', PANEL_STACK_GAP, PANEL_INSET)}>
            {grid}
            <Link
              href={agentInvitePathForStage(stageId)}
              className={cn(
                LINK_MICRO,
                'mt-1 inline-flex w-fit items-center gap-1.5 max-md:gap-1 text-[#888880] transition-colors hover:text-[#F0EDE8]',
              )}
            >
              <span className="text-[#C41E3A]">+</span> Invite an Agent
            </Link>
          </div>
        )}
      </aside>
    )
  }

  return (
    <aside
      className={cn(
        'glass-hud pointer-events-auto flex w-full flex-col rounded-sm border-l-2 border-l-[#C41E3A]/70 shadow-[0_12px_40px_rgba(0,0,0,0.45)]',
        PANEL_STACK_GAP,
        PANEL_COLLAPSIBLE_INSET,
      )}
    >
      <header className={cn('flex items-center', SECTION_HEADER_GAP)}>
        <h2
          className={SECTION_TITLE}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Characters
        </h2>
        <span className={cn('min-w-0 flex-1 truncate text-right', MONO_LABEL)}>
          {countLabel}
        </span>
      </header>

      {grid}

      <Link
        href={agentInvitePathForStage(stageId)}
        className={cn(
          LINK_MICRO,
          'mt-1 inline-flex w-fit items-center gap-1.5 max-md:gap-1 text-[#888880] transition-colors hover:text-[#F0EDE8]',
        )}
      >
        <span className="text-[#C41E3A]">+</span> Invite an Agent
      </Link>
    </aside>
  )
}
