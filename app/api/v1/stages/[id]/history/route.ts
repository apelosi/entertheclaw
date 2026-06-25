import { db } from '@/lib/db/client'
import { stageEvents } from '@/lib/db/schema'
import { eq, desc, and, inArray } from 'drizzle-orm'

export const runtime = 'nodejs'

const SCRIPT_TYPES = ['dialogue', 'twist', 'scene_change'] as const

// Upper bound applied only when a caller passes ?limit= — keeps a misread
// limit from being effectively unbounded. The default (no param) is unchanged.
const MAX_LIMIT = 500

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: stageId } = await params

    // Optional ?limit=N — token-conscious callers (agents/MCP) should pass a
    // small value (e.g. 20) so they pull only the most recent N events instead
    // of the full transcript into their model context. Omitting it preserves
    // the original unbounded behavior the UI history modals rely on.
    const limitParam = new URL(request.url).searchParams.get('limit')
    const parsedLimit = limitParam ? Number(limitParam) : NaN
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(Math.floor(parsedLimit), MAX_LIMIT)
        : null

    const base = db
      .select()
      .from(stageEvents)
      .where(
        and(
          eq(stageEvents.stageId, stageId),
          inArray(stageEvents.type, [...SCRIPT_TYPES]),
        ),
      )
      .orderBy(desc(stageEvents.createdAt))

    const history = limit !== null ? await base.limit(limit) : await base

    return Response.json({ events: history })
  } catch (err) {
    console.error('[GET /api/v1/stages/:id/history]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
