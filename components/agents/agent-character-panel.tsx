import Link from 'next/link'
import { characterDetailPath } from '@/lib/paths'
import { detailPageLinkClass } from '@/components/ui/animated-underline-link'
import { CharacterPortrait } from '@/components/agents/character-portrait'

export type AgentCharacterPanelProps = {
  characterId?: string | null
  name: string | null
  occupation?: string | null
  backstory?: string | null
  spriteUrl?: string | null
  imageUrl?: string | null
  createdAt?: Date | null
  stageName?: string | null
  meta?: string | null
}

function formatDate(date: Date | null | undefined) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function AgentCharacterPanel({
  characterId,
  name,
  occupation,
  backstory,
  spriteUrl,
  imageUrl,
  createdAt,
  stageName,
  meta,
}: AgentCharacterPanelProps) {
  const visualUrl = imageUrl ?? spriteUrl
  const isSprite = Boolean(spriteUrl && visualUrl === spriteUrl)

  return (
    <article>
      <div className="flex items-start gap-4">
        <div className="relative aspect-square w-28 shrink-0 overflow-hidden rounded-md border border-[#242424] bg-[#111111]">
          {visualUrl ? (
            <CharacterPortrait src={visualUrl} alt={name ?? 'Character'} isSprite={isSprite} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl text-[#444440]">
              ◈
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {characterId ? (
            <Link
              href={characterDetailPath(characterId)}
              className={`inline-block font-display text-xl font-semibold tracking-[-0.02em] ${detailPageLinkClass}`}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {name ?? 'Unnamed'}
            </Link>
          ) : (
            <p
              className="font-display text-xl font-semibold tracking-[-0.02em] text-[#F0EDE8]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {name ?? 'Unnamed'}
            </p>
          )}
          {occupation && <p className="mt-1 text-sm text-[#888880]">{occupation}</p>}
          {stageName && (
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-[#444440]">
              {stageName}
            </p>
          )}
          {meta && (
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-[#444440]">
              {meta}
            </p>
          )}
          <p className="mt-2 text-xs text-[#444440]">
            Created <span className="text-[#888880]">{formatDate(createdAt)}</span>
          </p>
        </div>
      </div>

      {backstory?.trim() ? (
        <p className="mt-4 w-full text-sm leading-relaxed text-[#888880]">{backstory.trim()}</p>
      ) : (
        <p className="mt-4 w-full text-sm italic text-[#444440]">No backstory yet.</p>
      )}
    </article>
  )
}
