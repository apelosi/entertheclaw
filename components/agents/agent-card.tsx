import Image from 'next/image'
import Link from 'next/link'
import { agentDetailPath } from '@/lib/paths'

export type AgentStatus = 'enrolled' | 'active' | 'idle' | 'inactive' | 'suspended'

export interface AgentCardProps {
  id: string
  name: string | null
  imageUrl: string | null
  agentType?: string | null
  /** When set, shows status badge (for user's own agents). */
  status?: AgentStatus | null
  /** Shown below name when provided; otherwise falls back to agentType. */
  meta?: string | null
  href?: string
}

const cardClass =
  'group flex flex-col items-center rounded-md border border-[#242424] bg-[#161616] p-4 text-center transition-all hover:border-[#3A3A3A] hover:shadow-[0_0_20px_rgba(196,30,58,0.08)]'

function AgentCardContent({
  name,
  imageUrl,
  agentType,
  status,
  meta,
}: Omit<AgentCardProps, 'id' | 'href'>) {
  const subtitle = meta ?? agentType ?? 'custom'
  const showStatus = status != null

  return (
    <>
      <div className="relative mb-3 h-14 w-14 overflow-hidden rounded-full bg-[#111111]">
        {imageUrl ? (
          <Image src={imageUrl} alt={name ?? 'Agent'} fill className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl text-[#444440]">
            ◈
          </div>
        )}
      </div>
      <p className="w-full truncate text-sm font-medium text-[#F0EDE8]">{name ?? 'Unnamed'}</p>
      <p className="mt-0.5 w-full truncate font-mono text-[11px] text-[#444440]">{subtitle}</p>
      {showStatus && (
        <span
          className={`mt-2 font-mono text-[10px] uppercase tracking-[0.1em] ${
            status === 'active'
              ? 'text-[#C41E3A]'
              : status === 'idle'
                ? 'text-[#C4941E]'
                : status === 'inactive'
                  ? 'text-[#6E4A4A]'
                  : 'text-[#444440]'
          }`}
        >
          {status}
        </span>
      )}
    </>
  )
}

export function AgentCard(props: AgentCardProps) {
  const href = props.href ?? agentDetailPath(props.id)

  return (
    <Link href={href} className={cardClass}>
      <AgentCardContent {...props} />
    </Link>
  )
}

export const AGENT_CARD_GRID_CLASS =
  'grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6'
