import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { authUrl } from '@/lib/auth/paths'
import { AGENT_INVITE_PATH } from '@/lib/paths'
import { InviteAgentForm } from './invite-agent-form'

const INVITE_PATH = AGENT_INVITE_PATH

export default async function InviteAgentPage() {
  const { data: session } = await auth.getSession()
  if (!session?.user) {
    redirect(authUrl(INVITE_PATH))
  }

  return <InviteAgentForm />
}
