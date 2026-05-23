'use client'

import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { characterDetailPath } from '@/lib/paths'

export interface OnStageCharacter {
  participantId: string
  agentId: string
  characterId: string | null
  role: 'main' | 'npc' | string
  characterName: string | null
  characterSpriteUrl: string | null
  characterImageUrl: string | null
  isMine: boolean
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
  const title = character.isMine
    ? `${character.characterName ?? 'Your character'} — view profile`
    : (character.characterName ?? 'Character')

  const className = cn(
    'group pointer-events-auto absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-transform duration-200',
    isActive && 'scale-110',
  )
  const style = { left: `${x * 100}%`, top: `${y * 100}%` }

  const inner = (
    <>
      <div
        className={cn(
          'relative h-16 w-16 overflow-hidden rounded-sm image-pixelated transition-all',
          isActive
            ? 'ring-2 ring-[#C41E3A] shadow-[0_0_36px_rgba(196,30,58,0.55)]'
            : character.isMine
              ? 'ring-2 ring-[#B8860B] shadow-[0_4px_14px_rgba(0,0,0,0.6)]'
              : 'shadow-[0_4px_14px_rgba(0,0,0,0.6)] group-hover:shadow-[0_4px_18px_rgba(0,0,0,0.8)]',
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
        {character.isMine && !isActive && (
          <span
            className="absolute right-1 top-1 inline-block h-1.5 w-1.5 rounded-full bg-[#B8860B] shadow-[0_0_6px_#B8860B]"
            aria-label="Your agent"
          />
        )}
      </div>
      <div
        className={cn(
          'mt-1 whitespace-nowrap px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors',
          isActive
            ? 'text-[#F0EDE8] [text-shadow:_0_0_8px_rgba(196,30,58,0.7)]'
            : 'text-[#F0EDE8]/80 [text-shadow:_0_1px_3px_rgba(0,0,0,0.9)]',
        )}
      >
        {character.characterName ?? 'Unnamed'}
      </div>
    </>
  )

  if (!character.characterId) {
    return (
      <div title={title} className={className} style={style}>
        {inner}
      </div>
    )
  }

  return (
    <Link
      href={characterDetailPath(character.characterId)}
      title={title}
      className={className}
      style={style}
    >
      {inner}
    </Link>
  )
}

/**
 * Place participants around the stage center.
 * Mains sit on an inner ring, NPCs on an outer ring. The container is rectangular
 * so we use elliptical placement to spread along the wider horizontal axis.
 */
export function layoutPositions(
  participants: OnStageCharacter[],
): Array<{ character: OnStageCharacter; x: number; y: number }> {
  const mains = participants.filter((p) => p.role === 'main')
  const npcs = participants.filter((p) => p.role !== 'main')

  const ring = (items: OnStageCharacter[], rx: number, ry: number) =>
    items.map((char, i) => {
      const count = items.length
      const angle = (i / Math.max(count, 1)) * 2 * Math.PI - Math.PI / 2
      return {
        character: char,
        x: 0.5 + Math.cos(angle) * rx,
        y: 0.55 + Math.sin(angle) * ry,
      }
    })

  // Mains on an inner ellipse; NPCs on a wider outer ellipse.
  return [...ring(mains, 0.22, 0.18), ...ring(npcs, 0.36, 0.28)]
}
