import Image from 'next/image'
import Link from 'next/link'
import { characterDetailPath } from '@/lib/paths'
import type { AgentStatus } from '@/components/agents/agent-card'

/** A live character's status is its owning agent's status verbatim (so it
 *  stays in sync with whatever AgentStatus allows, including edge cases like
 *  'unenrolled'/'suspended' for a character whose agent left mid-flight);
 *  'retired' is added on top for archived characters, which have no agent
 *  status of their own. */
export type CharacterStatus = AgentStatus | 'retired'

export interface CharacterCardProps {
  id: string
  name: string | null
  imageUrl: string | null
  occupation?: string | null
  stageId: string
  /** Character asset generation still in progress. */
  isComplete?: boolean | null
  /** Mirrors the owning agent's status while live; 'retired' once archived. */
  status?: CharacterStatus | null
  agentName?: string | null
  stageName?: string | null
}

const cardClass =
  'group flex flex-col overflow-hidden rounded-md border border-[#242424] bg-[#161616] transition-all hover:border-[#3A3A3A] hover:shadow-[0_0_20px_rgba(196,30,58,0.08)]'

function CharacterCardContent({
  name,
  imageUrl,
  occupation,
  isComplete,
  status,
  agentName,
  stageName,
  showOwnership,
}: Omit<CharacterCardProps, 'id' | 'stageId'> & { showOwnership: boolean }) {
  const showCreating = isComplete === false
  const showStatus = status != null && isComplete !== false

  return (
    <>
      <div className="relative aspect-square w-full bg-[#111111]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name ?? 'Character'}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, 200px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl text-[#444440]">
            ◈
          </div>
        )}
        {showCreating && (
          <span className="absolute right-2 top-2 rounded bg-[#C41E3A]/90 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white">
            Creating
          </span>
        )}
        {showStatus && (
          <span
            className={`absolute left-2 top-2 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
              status === 'active'
                ? 'bg-[#C41E3A]/90 text-white'
                : status === 'idle'
                  ? 'bg-[#C4941E]/90 text-white'
                  : status === 'inactive'
                    ? 'bg-[#6E4A4A]/90 text-white'
                    : 'bg-[#161616]/90 text-[#888880] ring-1 ring-[#444440]/60'
            }`}
          >
            {status}
          </span>
        )}
      </div>
      <div className="p-3">
        <p
          className="truncate text-base font-semibold tracking-[-0.02em] text-[#F0EDE8]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {name ?? 'Unknown'}
        </p>
        {occupation && (
          <p className="mt-0.5 truncate text-xs text-[#888880]">{occupation}</p>
        )}
        {showOwnership && (agentName || stageName) && (
          <p className="mt-1 truncate text-[11px] text-[#444440]">
            {agentName ?? 'Agent'}
            {stageName ? ` · ${stageName}` : ''}
          </p>
        )}
      </div>
    </>
  )
}

export function CharacterCard({
  id,
  stageId,
  agentName,
  stageName,
  status,
  ...rest
}: CharacterCardProps) {
  const showOwnership = Boolean(agentName || stageName)

  return (
    <Link href={characterDetailPath(id)} className={cardClass}>
      <CharacterCardContent
        {...rest}
        agentName={agentName}
        stageName={stageName}
        status={status}
        showOwnership={showOwnership}
      />
    </Link>
  )
}

export const CHARACTER_CARD_GRID_CLASS =
  'grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6'
