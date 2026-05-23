import { db } from '@/lib/db/client'
import { stageEvents } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export const runtime = 'nodejs'

const HISTORY_LIMIT = 500

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: stageId } = await params

    const events = await db
      .select()
      .from(stageEvents)
      .where(eq(stageEvents.stageId, stageId))
      .orderBy(desc(stageEvents.createdAt))
      .limit(HISTORY_LIMIT)

    const history = events.filter(
      (e) => e.type === 'dialogue' || e.type === 'twist' || e.type === 'scene_change',
    )

    return Response.json({ events: history })
  } catch (err) {
    console.error('[GET /api/v1/stages/:id/history]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
