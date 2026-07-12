import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/lib/db/client'
import { stages, stageParticipants, characters } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { Nav } from '@/components/nav'
import { StageHistoryView } from '@/components/stage/stage-history-view'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const [stage] = await db
    .select({ name: stages.name })
    .from(stages)
    .where(eq(stages.id, id))
    .limit(1)
  return { title: stage ? `${stage.name} — history` : 'Stage Not Found' }
}

export default async function StageHistoryPage({ params }: Props) {
  const { id } = await params

  const [stage] = await db
    .select({ id: stages.id, name: stages.name })
    .from(stages)
    .where(eq(stages.id, id))
    .limit(1)
  if (!stage) notFound()

  // Character images for dialogue avatars, keyed by speaker name.
  const participants = await db
    .select({
      characterName: characters.name,
      characterImageUrl: characters.imageUrl,
    })
    .from(stageParticipants)
    .leftJoin(
      characters,
      and(
        eq(characters.agentId, stageParticipants.agentId),
        eq(characters.stageId, id),
      ),
    )
    .where(eq(stageParticipants.stageId, id))

  const speakerImages: Record<string, string | null> = {}
  for (const p of participants) {
    if (p.characterName) speakerImages[p.characterName] = p.characterImageUrl
  }

  return (
    <>
      <Nav />
      <StageHistoryView stageId={stage.id} stageName={stage.name} speakerImages={speakerImages} />
    </>
  )
}
