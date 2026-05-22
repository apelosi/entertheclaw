'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

export interface OnStageCharacter {
  participantId: string
  agentId: string
  role: 'main' | 'npc' | string
  characterName: string | null
  characterSpriteUrl: string | null
  characterImageUrl: string | null
}

interface Props {
  character: OnStageCharacter
  /** Normalized position 0..1 inside the stage container. */
  x: number
  y: number
  isActive?: boolean
}

export function CharacterOnStage({ character, x, y, isActive }: Props) {
  const sprite = character.characterSpriteUrl ?? character.characterImageUrl

  return (
    <div
      className="pointer-events-auto absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
    >
      <div
        className={cn(
          'relative h-16 w-16 overflow-hidden rounded-sm bg-[#0e0e0e] shadow-lg image-pixelated',
          isActive
            ? 'border border-[#C41E3A] shadow-[0_0_24px_rgba(196,30,58,0.45)]'
            : character.role === 'main'
              ? 'border border-[#C41E3A]/40'
              : 'border border-[#B8860B]/30'
        )}
      >
        {sprite ? (
          <Image
            src={sprite}
            alt={character.characterName ?? 'Character'}
            fill
            sizes="64px"
            className="object-cover image-pixelated"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a]">
            <span className="text-3xl text-[#C41E3A]/60">◈</span>
          </div>
        )}
      </div>
      <div className="mt-1 whitespace-nowrap rounded-sm border-t border-l border-[#3A3A3A]/40 bg-[#0e0e0e]/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-[#888880] backdrop-blur-sm">
        {character.characterName ?? 'Unnamed'}
      </div>
    </div>
  )
}

/**
 * Place participants around a circular stage center.
 * Mains sit on an inner ring, NPCs on an outer ring.
 */
export function layoutPositions(
  participants: OnStageCharacter[]
): Array<{ character: OnStageCharacter; x: number; y: number }> {
  const mains = participants.filter((p) => p.role === 'main')
  const npcs = participants.filter((p) => p.role !== 'main')

  const ring = (items: OnStageCharacter[], radius: number) =>
    items.map((char, i) => {
      const count = items.length
      const angle = (i / Math.max(count, 1)) * 2 * Math.PI - Math.PI / 2
      return {
        character: char,
        x: 0.5 + Math.cos(angle) * radius,
        y: 0.5 + Math.sin(angle) * radius,
      }
    })

  return [...ring(mains, 0.26), ...ring(npcs, 0.4)]
}
