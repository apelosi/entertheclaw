import { db } from '@/lib/db/client'
import { stages, stageEvents, agents } from '@/lib/db/schema'
import { auth } from '@/lib/auth'
import {
  parseFeedEventTypesParam,
  parseFeedLimit,
  queryStageEventsBefore,
} from '@/lib/stage/query-stage-events'
import { enrichCastEvents } from '@/lib/stage/stage-cast-context'
import { eq, and, inArray, sql } from 'drizzle-orm'

export const runtime = 'nodejs'

const DEFAULT_FEED_TYPES = ['dialogue', 'scene_change', 'twist', 'joined', 'left']

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: stageId } = await params

    const [stage] = await db
      .select({ id: stages.id })
      .from(stages)
      .where(eq(stages.id, stageId))
      .limit(1)

    if (!stage) {
      return Response.json({ error: 'Stage not found' }, { status: 404 })
    }

    const url = new URL(request.url)
    const before = url.searchParams.get('before')
    const typesParam = url.searchParams.get('types')
    const limitParam = url.searchParams.get('limit')

    let types = DEFAULT_FEED_TYPES
    if (typesParam) {
      const parsed = parseFeedEventTypesParam(typesParam)
      if (!parsed) {
        return Response.json({ error: 'Invalid types' }, { status: 400 })
      }
      types = parsed
    }

    const limit = parseFeedLimit(limitParam)

    const result = await queryStageEventsBefore({ stageId, types, before, limit })
    if ('error' in result) {
      return Response.json({ error: 'Invalid before cursor' }, { status: 400 })
    }

    const { events, hasMore } = result

    // Optional session read: when logged in, resolve isOwn per event —
    // dialogue via stage_events.agent_id -> agents.user_id, twists via the
    // row's own user_id (the submitter). The top-level user_id column is
    // stripped from the response either way.
    const { data: session } = await auth.getSession()
    const userId = session?.user?.id ?? null

    let ownAgentIds: Set<string> | null = null
    if (userId && events.length > 0) {
      const agentIds = [
        ...new Set(
          events
            .map((e) => e.agentId)
            .filter((id): id is string => typeof id === 'string'),
        ),
      ]
      if (agentIds.length > 0) {
        const ownAgents = await db
          .select({ id: agents.id })
          .from(agents)
          .where(and(inArray(agents.id, agentIds), eq(agents.userId, userId)))
        ownAgentIds = new Set(ownAgents.map((a) => a.id))
      }
    }

    const ownedEvents = events.map(({ userId: eventUserId, ...rest }) => {
      const isOwn =
        userId !== null &&
        ((rest.agentId !== null && ownAgentIds?.has(rest.agentId) === true) ||
          eventUserId === userId)
      return isOwn ? { ...rest, isOwn: true } : rest
    })

    // Attach character/agent/owner labels to any cast (joined/left) rows.
    const responseEvents = await enrichCastEvents(ownedEvents, stageId)

    let total: number | undefined
    if (!before) {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(stageEvents)
        .where(
          and(
            eq(stageEvents.stageId, stageId),
            inArray(
              stageEvents.type,
              types as ('dialogue' | 'scene_change' | 'twist' | 'joined' | 'left')[],
            ),
          ),
        )
      total = row?.count ?? 0
    }

    const nextCursor = hasMore
      ? responseEvents[responseEvents.length - 1]?.id ?? null
      : null

    return Response.json({
      events: responseEvents,
      nextCursor,
      hasMore,
      ...(total !== undefined ? { total } : {}),
    })
  } catch (err) {
    console.error('[GET /api/v1/stages/:id/feed]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
