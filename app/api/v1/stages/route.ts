import { db } from '@/lib/db/client'
import { stages, stageParticipants } from '@/lib/db/schema'
import { eq, count } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const allStages = await db.select().from(stages).where(eq(stages.isActive, true))

    const stagesWithCounts = await Promise.all(
      allStages.map(async (stage) => {
        const [{ total }] = await db
          .select({ total: count() })
          .from(stageParticipants)
          .where(eq(stageParticipants.stageId, stage.id))

        return { ...stage, participantCount: Number(total) }
      })
    )

    return Response.json({ stages: stagesWithCounts })
  } catch (err) {
    console.error('[GET /api/v1/stages]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
