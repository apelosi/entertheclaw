'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

export interface DramatisCharacter {
  participantId: string
  agentId: string
  role: string
  characterName: string | null
  characterImageUrl: string | null
}

interface Props {
  mainCharacters: DramatisCharacter[]
  activeAgentId: string | null
  maxSlots?: number
}

export function DramatisPersonae({
  mainCharacters,
  activeAgentId,
  maxSlots = 12,
}: Props) {
  const slots: (DramatisCharacter | null)[] = Array.from({ length: maxSlots }, (_, i) => mainCharacters[i] ?? null)
  const activeCount = mainCharacters.length

  return (
    <aside className="glass-hud pointer-events-auto hidden w-72 flex-col gap-4 rounded-sm p-4 shadow-2xl lg:flex">
      <header className="flex items-center gap-2 border-b border-[#242424]/60 pb-2">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#B8860B]">●</span>
        <h2
          className="text-lg italic tracking-wide text-[#B8860B]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Dramatis Personae
        </h2>
      </header>

      <div className="grid grid-cols-4 gap-2">
        {slots.map((char, i) => {
          if (!char) {
            return (
              <div
                key={`empty-${i}`}
                className="flex aspect-square items-center justify-center rounded-sm border border-[#242424]/40 bg-[#0e0e0e]/50"
              >
                <span className="text-xs text-[#444440]">×</span>
              </div>
            )
          }

          const isActive = char.agentId === activeAgentId

          return (
            <div
              key={char.participantId}
              className={cn(
                'group relative aspect-square overflow-hidden rounded-sm bg-[#0e0e0e]',
                isActive
                  ? 'border border-[#C41E3A] shadow-[0_0_18px_rgba(196,30,58,0.45)]'
                  : 'border border-[#242424]/40'
              )}
              title={char.characterName ?? 'Unnamed character'}
            >
              {isActive && (
                <div className="pointer-events-none absolute inset-0 z-10 bg-[#C41E3A]/15" />
              )}
              {char.characterImageUrl ? (
                <Image
                  src={char.characterImageUrl}
                  alt={char.characterName ?? 'Character'}
                  fill
                  sizes="64px"
                  className={cn(
                    'object-cover transition-opacity image-pixelated',
                    isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'
                  )}
                />
              ) : (
                <div
                  className={cn(
                    'flex h-full w-full items-center justify-center',
                    isActive ? 'bg-[#C41E3A]/30' : 'bg-[#1a1a1a]'
                  )}
                >
                  <span className="text-lg text-[#444440]">◈</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="text-right font-mono text-[10px] uppercase tracking-[0.18em] text-[#444440]">
        Active count: {String(activeCount).padStart(2, '0')}/{String(maxSlots).padStart(2, '0')}
      </div>
    </aside>
  )
}
