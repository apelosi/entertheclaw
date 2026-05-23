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
import { eq, desc, and } from 'drizzle-orm'
import type { Metadata } from 'next'
import StageViewClient from '@/components/stage/stage-view-client'
import { Nav } from '@/components/nav'
import { resolveStageImageUrl } from '@/lib/db/stage-image-by-name'
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
      characterId: characters.id,
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

  // Resolve initial current scene: latest scene_change event content, falling
  // back to the seeded initial_scene_* columns. We scan recentEvents instead
  // of issuing another query since recentEvents already covers 50 events.
  let initialScene: { name: string; description: string } | null = null
  const latestSceneEvent = recentEvents.find((e) => e.type === 'scene_change')
  if (
    latestSceneEvent &&
    typeof latestSceneEvent.content === 'object' &&
    latestSceneEvent.content !== null
  ) {
    const c = latestSceneEvent.content as Record<string, unknown>
    if (typeof c.name === 'string' && typeof c.description === 'string') {
      initialScene = { name: c.name, description: c.description }
    }
  }
  if (!initialScene && stage.initialSceneName && stage.initialSceneDescription) {
    initialScene = {
      name: stage.initialSceneName,
      description: stage.initialSceneDescription,
    }
  }

  const hasCastOnStage = participants.some(
    (p) => typeof p.characterName === 'string' && p.characterName.trim().length > 0,
  )

  return {
    stage,
    participants,
    recentEvents,
    initialScene,
    stageIsActive: stage.isActive ?? true,
    hasCastOnStage,
    lastTwistAt: lastStageTwist?.createdAt ? new Date(lastStageTwist.createdAt).getTime() : null,
    lastUserTwistAt: lastUserTwist?.createdAt
      ? new Date(lastUserTwist.createdAt).getTime()
      : null,
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
    initialScene,
    lastTwistAt,
    lastUserTwistAt,
    stageIsActive,
    hasCastOnStage,
  } = data

  const twistsEnabled = stageIsActive && hasCastOnStage

  return (
    <>
      <Nav />
      <StageViewClient
        stageId={stage.id}
        stageName={stage.name}
        stageTheme={stage.theme}
        stageDescription={stage.description ?? null}
        stageImageUrl={resolveStageImageUrl(stage)}
        stageCreatedAt={stage.createdAt ? stage.createdAt.toISOString() : null}
        participants={participants}
        initialEvents={recentEvents}
        initialScene={initialScene}
        isLoggedIn={Boolean(userId)}
        currentUserId={userId}
        twistsEnabled={twistsEnabled}
        lastTwistAt={twistsEnabled ? lastTwistAt : null}
        lastUserTwistAt={twistsEnabled ? lastUserTwistAt : null}
      />
    </>
  )
}
