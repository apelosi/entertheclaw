'use client'

import Link from 'next/link'
import { useSession } from '@/lib/auth-client'
import { agentInvitePathForRepair } from '@/lib/paths'
import { cn } from '@/lib/utils'

interface Props {
  agentId: string
  ownerUserId: string
  /** Server-rendered ownership hint; client session can still reveal the control. */
  serverIsOwner?: boolean
  currentStageId: string | null
  agentStatus: string
  className?: string
}

/**
 * Owner-only Re-invite CTA under agent Details.
 * Visible when the agent is on a stage and status is not active.
 */
export function ReinviteAgentControl({
  agentId,
  ownerUserId,
  serverIsOwner = false,
  currentStageId,
  agentStatus,
  className,
}: Props) {
  const { data: session, isPending } = useSession()
  const clientIsOwner = Boolean(
    session?.user?.id && session.user.id === ownerUserId,
  )
  const isOwner = serverIsOwner || clientIsOwner

  if (!isOwner) {
    if (isPending && !serverIsOwner) return null
    return null
  }

  if (!currentStageId || agentStatus === 'active') return null

  const href = agentInvitePathForRepair({
    stageId: currentStageId,
    agentId,
  })

  return (
    <div className={cn('space-y-2', className)}>
      <Link
        href={href}
        className={cn(
          'inline-flex h-10 items-center justify-center rounded px-4 text-[14px] font-medium tracking-[0.01em]',
          'border border-[#3A3A3A] bg-transparent text-[#F0EDE8] transition-all duration-[120ms] ease-out',
          'hover:bg-[#161616]',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C41E3A] focus-visible:ring-offset-1 focus-visible:ring-offset-[#080808]',
        )}
      >
        Re-invite
      </Link>
      <p className="text-xs text-[#888880]">
        If your agent is experiencing issues communicating with the platform, generate a prompt to
        help them re-establish communication.
      </p>
    </div>
  )
}
