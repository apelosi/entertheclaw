import { db } from '@/lib/db/client'
import { stageEvents } from '@/lib/db/schema'
import { eq, desc, and, inArray } from 'drizzle-orm'

export const runtime = 'nodejs'

const SCRIPT_TYPES = ['dialogue', 'twist', 'scene_change'] as const

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: stageId } = await params

    const history = await db
      .select()
      .from(stageEvents)
      .where(
        and(
          eq(stageEvents.stageId, stageId),
          inArray(stageEvents.type, SCRIPT_TYPES),
        ),
      )
      .orderBy(desc(stageEvents.createdAt))

    return Response.json({ events: history })
  } catch (err) {
    console.error('[GET /api/v1/stages/:id/history]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
