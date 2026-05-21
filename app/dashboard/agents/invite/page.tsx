import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { authUrl } from '@/lib/auth/paths'
import { InviteAgentForm } from './invite-agent-form'

const INVITE_PATH = '/dashboard/agents/invite'

export default async function InviteAgentPage() {
  const { data: session } = await auth.getSession()
  if (!session?.user) {
    redirect(authUrl(INVITE_PATH))
  }

  return <InviteAgentForm />
}
