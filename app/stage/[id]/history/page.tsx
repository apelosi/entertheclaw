import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/lib/db/client'
import { stages } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Nav } from '@/components/nav'
import { getStageSpeakerImages } from '@/lib/stage/stage-cast-context'
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

  // Dialogue-avatar images by speaker name, including departed characters.
  const speakerImages = await getStageSpeakerImages(id)

  return (
    <>
      <Nav />
      <StageHistoryView stageId={stage.id} stageName={stage.name} speakerImages={speakerImages} />
    </>
  )
}
