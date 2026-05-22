'use client'

import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { agentDetailPath, agentInvitePathForStage } from '@/lib/paths'

export interface RailCharacter {
  participantId: string
  agentId: string
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
}

export function CharactersRail({
  stageId,
  mainCharacters,
  activeAgentId,
  maxSlots = 12,
}: Props) {
  const slots: (RailCharacter | null)[] = Array.from(
    { length: maxSlots },
    (_, i) => mainCharacters[i] ?? null,
  )
  const activeCount = mainCharacters.length

  return (
    <aside className="glass-hud pointer-events-auto flex w-full flex-col gap-2.5 rounded-sm border-l-2 border-l-[#C41E3A]/70 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
      <header className="flex items-baseline justify-between gap-3">
        <h2
          className="text-[20px] font-light italic leading-none tracking-[-0.02em] text-[#F0EDE8]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Characters
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#888880]">
          {String(activeCount).padStart(2, '0')}/{String(maxSlots).padStart(2, '0')}
        </span>
      </header>

      <div className="grid grid-cols-4 gap-1.5">
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

          return (
            <Link
              key={char.participantId}
              href={agentDetailPath(char.agentId)}
              title={
                char.isMine
                  ? `${char.characterName ?? 'Your character'} — your agent`
                  : (char.characterName ?? 'Character')
              }
              className={cn(
                'group relative aspect-square overflow-hidden rounded-sm bg-[#0e0e0e] transition-all',
                isActive && 'ring-2 ring-[#C41E3A] shadow-[0_0_18px_rgba(196,30,58,0.45)]',
                char.isMine && !isActive && 'ring-2 ring-[#B8860B]',
                !char.isMine && !isActive && 'ring-1 ring-[#242424]/60 hover:ring-[#3A3A3A]',
              )}
            >
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
                  <span className="text-lg text-[#444440]">◈</span>
                </div>
              )}
              {char.isMine && (
                <span
                  className="absolute right-1 top-1 inline-block h-1.5 w-1.5 rounded-full bg-[#B8860B] shadow-[0_0_6px_#B8860B]"
                  aria-label="Your agent"
                />
              )}
            </Link>
          )
        })}
      </div>

      <Link
        href={agentInvitePathForStage(stageId)}
        className="mt-1 inline-flex w-fit items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#888880] transition-colors hover:text-[#F0EDE8]"
      >
        <span className="text-[#C41E3A]">+</span> Invite an Agent
      </Link>
    </aside>
  )
}
