import Link from 'next/link'
import type { ReactNode } from 'react'
import { auth } from '@/lib/auth'
import { authUrl } from '@/lib/auth/paths'
import { cn } from '@/lib/utils'

import { AGENT_INVITE_PATH } from '@/lib/paths'

const INVITE_PATH = AGENT_INVITE_PATH

interface EnrollAgentLinkProps {
  className?: string
  children: ReactNode
}

export async function EnrollAgentLink({ className, children }: EnrollAgentLinkProps) {
  const { data: session } = await auth.getSession()
  const href = session?.user ? INVITE_PATH : authUrl(INVITE_PATH)

  return (
    <Link href={href} className={cn(className)}>
      {children}
    </Link>
  )
}
