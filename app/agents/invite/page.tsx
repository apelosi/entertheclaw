import { Nav } from '@/components/nav'
import { getServerSession } from '@/lib/auth/get-server-session'
import { displayNameOnboardingPath, needsDisplayName } from '@/lib/auth/display-name'
import { redirect } from 'next/navigation'
import { authUrl } from '@/lib/auth/paths'
import { AGENT_INVITE_PATH } from '@/lib/paths'
import type { Metadata } from 'next'
import { db } from '@/lib/db/client'
import { stages, stageParticipants } from '@/lib/db/schema'
import { eq, count } from 'drizzle-orm'
import { resolveStageImageUrl } from '@/lib/db/stage-image-by-name'
import { InviteAgentForm, type InviteStageOption } from './invite-agent-form'

export const metadata: Metadata = { title: 'Invite Agent' }

const INVITE_PATH = AGENT_INVITE_PATH

async function getInviteStages(): Promise<InviteStageOption[]> {
  const all = await db
    .select({
      id: stages.id,
      name: stages.name,
      theme: stages.theme,
      description: stages.description,
      imageUrl: stages.imageUrl,
      maxMainCharacters: stages.maxMainCharacters,
    })
    .from(stages)
    .where(eq(stages.isActive, true))

  // Get main participant count per stage so we can show "X/12 main slots taken".
  const withCounts: InviteStageOption[] = await Promise.all(
    all.map(async (s) => {
      const [{ total }] = await db
        .select({ total: count() })
        .from(stageParticipants)
        .where(eq(stageParticipants.stageId, s.id))
      return {
        id: s.id,
        name: s.name,
        theme: s.theme,
        description: s.description ?? null,
        imageUrl: resolveStageImageUrl(s),
        maxMainCharacters: s.maxMainCharacters ?? 12,
        participantCount: Number(total),
      }
    })
  )

  return withCounts.sort((a, b) => a.name.localeCompare(b.name))
}

interface InvitePageProps {
  searchParams: Promise<{ stage?: string }>
}

export default async function InviteAgentPage({ searchParams }: InvitePageProps) {
  const { stage: requestedStageId } = await searchParams
  const { data: session } = await getServerSession()
  if (!session?.user) {
    redirect(authUrl(INVITE_PATH))
  }

  if (needsDisplayName(session.user)) {
    redirect(displayNameOnboardingPath(INVITE_PATH))
  }

  const inviteStages = await getInviteStages().catch(() => [] as InviteStageOption[])

  const initialStageId =
    requestedStageId && inviteStages.some((s) => s.id === requestedStageId)
      ? requestedStageId
      : null

  return (
    <>
      <Nav />
      <InviteAgentForm stages={inviteStages} initialStageId={initialStageId} />
    </>
  )
}
