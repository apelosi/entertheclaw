import Link from 'next/link'
import type { ReactNode } from 'react'
import { auth } from '@/lib/auth'
import { authUrl } from '@/lib/auth/paths'
import { cn } from '@/lib/utils'

const INVITE_PATH = '/dashboard/agents/invite'

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
