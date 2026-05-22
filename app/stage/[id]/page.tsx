import { notFound } from 'next/navigation'
import { db } from '@/lib/db/client'
import {
  stages,
  stageParticipants,
  characters,
  stageEvents,
  twists,
  agents,
} from '@/lib/db/schema'
import { eq, desc, and, count } from 'drizzle-orm'
import type { Metadata } from 'next'
import StageViewClient from '@/components/stage/stage-view-client'
import { Nav } from '@/components/nav'
import { getServerSession } from '@/lib/auth/get-server-session'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const [stage] = await db.select().from(stages).where(eq(stages.id, id)).limit(1)
  if (!stage) return { title: 'Stage Not Found' }
  return { title: stage.name }
}

async function getStageData(id: string, userId: string | null) {
  const [stage] = await db.select().from(stages).where(eq(stages.id, id)).limit(1)
  if (!stage) return null

  const participants = await db
    .select({
      participantId: stageParticipants.id,
      role: stageParticipants.role,
      agentId: stageParticipants.agentId,
      agentUserId: agents.userId,
      characterName: characters.name,
      characterOccupation: characters.occupation,
      characterImageUrl: characters.imageUrl,
      characterSpriteUrl: characters.spriteUrl,
    })
    .from(stageParticipants)
    .leftJoin(agents, eq(agents.id, stageParticipants.agentId))
    .leftJoin(
      characters,
      and(
        eq(characters.agentId, stageParticipants.agentId),
        eq(characters.stageId, id),
      ),
    )
    .where(eq(stageParticipants.stageId, id))

  const recentEvents = await db
    .select()
    .from(stageEvents)
    .where(eq(stageEvents.stageId, id))
    .orderBy(desc(stageEvents.createdAt))
    .limit(50)

  const [lastStageTwist] = await db
    .select({ createdAt: twists.createdAt })
    .from(twists)
    .where(eq(twists.stageId, id))
    .orderBy(desc(twists.createdAt))
    .limit(1)

  const [lineCountRow] = await db
    .select({ count: count() })
    .from(stageEvents)
    .where(and(eq(stageEvents.stageId, id), eq(stageEvents.type, 'dialogue')))

  const [twistCountRow] = await db
    .select({ count: count() })
    .from(stageEvents)
    .where(and(eq(stageEvents.stageId, id), eq(stageEvents.type, 'twist')))

  let lastUserTwist: { createdAt: Date | null } | null = null
  if (userId) {
    const [row] = await db
      .select({ createdAt: twists.createdAt })
      .from(twists)
      .where(eq(twists.userId, userId))
      .orderBy(desc(twists.createdAt))
      .limit(1)
    lastUserTwist = row ?? null
  }

  return {
    stage,
    participants,
    recentEvents,
    lastTwistAt: lastStageTwist?.createdAt ? new Date(lastStageTwist.createdAt).getTime() : null,
    lastUserTwistAt: lastUserTwist?.createdAt
      ? new Date(lastUserTwist.createdAt).getTime()
      : null,
    lineCount: Number(lineCountRow?.count ?? 0),
    twistCount: Number(twistCountRow?.count ?? 0),
  }
}

export default async function StagePage({ params }: Props) {
  const { id } = await params
  const { data: session } = await getServerSession()
  const userId = session?.user?.id ?? null

  const data = await getStageData(id, userId)
  if (!data) notFound()

  const {
    stage,
    participants,
    recentEvents,
    lastTwistAt,
    lastUserTwistAt,
    lineCount,
    twistCount,
  } = data

  return (
    <>
      <Nav />
      <StageViewClient
        stageId={stage.id}
        stageName={stage.name}
        stageTheme={stage.theme}
        stageDescription={stage.description ?? null}
        stageImageUrl={stage.imageUrl ?? null}
        participants={participants}
        initialEvents={recentEvents}
        isLoggedIn={Boolean(userId)}
        currentUserId={userId}
        lastTwistAt={lastTwistAt}
        lastUserTwistAt={lastUserTwistAt}
        initialLineCount={lineCount}
        initialTwistCount={twistCount}
      />
    </>
  )
}
