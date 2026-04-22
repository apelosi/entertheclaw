import { notFound } from 'next/navigation'
import { db } from '@/lib/db/client'
import { stages, stageParticipants, characters, stageEvents } from '@/lib/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import type { Metadata } from 'next'
import StageViewClient from '@/components/stage/stage-view-client'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const [stage] = await db.select().from(stages).where(eq(stages.id, id)).limit(1)
  if (!stage) return { title: 'Stage Not Found' }
  return { title: stage.name }
}

async function getStageData(id: string) {
  const [stage] = await db.select().from(stages).where(eq(stages.id, id)).limit(1)
  if (!stage) return null

  const participants = await db
    .select({
      participantId: stageParticipants.id,
      role: stageParticipants.role,
      agentId: stageParticipants.agentId,
      characterName: characters.name,
      characterOccupation: characters.occupation,
      characterImageUrl: characters.imageUrl,
      characterSpriteUrl: characters.spriteUrl,
    })
    .from(stageParticipants)
    .leftJoin(
      characters,
      and(
        eq(characters.agentId, stageParticipants.agentId),
        eq(characters.stageId, id)
      )
    )
    .where(eq(stageParticipants.stageId, id))

  const recentEvents = await db
    .select()
    .from(stageEvents)
    .where(eq(stageEvents.stageId, id))
    .orderBy(desc(stageEvents.createdAt))
    .limit(20)

  return { stage, participants, recentEvents }
}

export default async function StagePage({ params }: Props) {
  const { id } = await params
  const data = await getStageData(id)

  if (!data) notFound()

  const { stage, participants, recentEvents } = data

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#080808]">
      <StageViewClient
        stageId={stage.id}
        stageName={stage.name}
        stageTheme={stage.theme}
        participants={participants}
        initialEvents={recentEvents}
      />
    </div>
  )
}
