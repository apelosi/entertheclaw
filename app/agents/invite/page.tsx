import { Nav } from '@/components/nav'
import { getServerSession } from '@/lib/auth/get-server-session'
import { displayNameOnboardingPath } from '@/lib/auth/display-name'
import { userNeedsDisplayName } from '@/lib/users/public-profile'
import { redirect } from 'next/navigation'
import { authUrl } from '@/lib/auth/paths'
import { AGENT_INVITE_PATH } from '@/lib/paths'
import type { Metadata } from 'next'
import { db } from '@/lib/db/client'
import { agents, stages, stageParticipants } from '@/lib/db/schema'
import { and, count, desc, eq, isNotNull } from 'drizzle-orm'
import { resolveStageImageUrl } from '@/lib/db/stage-image-by-name'
import {
  InviteAgentForm,
  type InviteReusableAgent,
  type InviteStageOption,
} from './invite-agent-form'

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

async function getReusableAgents(userId: string): Promise<InviteReusableAgent[]> {
  const rows = await db
    .select({
      id: agents.id,
      name: agents.name,
      agentType: agents.agentType,
      status: agents.status,
    })
    .from(agents)
    .where(and(eq(agents.userId, userId), isNotNull(agents.name)))
    .orderBy(desc(agents.enrolledAt))

  return rows
    .filter((r): r is typeof r & { name: string } => Boolean(r.name?.trim()))
    .map((r) => ({
      id: r.id,
      name: r.name.trim(),
      agentType: r.agentType,
      status: r.status,
    }))
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

  if (await userNeedsDisplayName(session.user.id)) {
    redirect(displayNameOnboardingPath(INVITE_PATH))
  }

  const [inviteStages, reusableAgents] = await Promise.all([
    getInviteStages().catch(() => [] as InviteStageOption[]),
    getReusableAgents(session.user.id).catch(() => [] as InviteReusableAgent[]),
  ])

  const initialStageId =
    requestedStageId && inviteStages.some((s) => s.id === requestedStageId)
      ? requestedStageId
      : null

  return (
    <>
      <Nav />
      <InviteAgentForm
        stages={inviteStages}
        reusableAgents={reusableAgents}
        initialStageId={initialStageId}
      />
    </>
  )
}
