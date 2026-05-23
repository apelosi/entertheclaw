import { db } from '@/lib/db/client'
import { stageEvents, stageParticipants } from '@/lib/db/schema'
import { verifyAgentApiKey } from '@/lib/api/agent-auth'
import {
  parseEventTypesParam,
  parseEventsLimit,
  queryFilteredStageEvents,
} from '@/lib/stage/query-stage-events'
import { and, asc, desc, eq, gt, ne } from 'drizzle-orm'

export const runtime = 'nodejs'

/** Agent JSON history when `?types=` is set; otherwise public SSE stream. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: stageId } = await params
  const url = new URL(request.url)
  const typesParam = url.searchParams.get('types')

  if (typesParam !== null) {
    return handleAgentEventsJson(request, stageId, url)
  }

  return handleStageEventsSse(request, stageId)
}

async function handleAgentEventsJson(
  request: Request,
  stageId: string,
  url: URL,
) {
  const agent = await verifyAgentApiKey(request)
  if (!agent) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [participant] = await db
    .select({ id: stageParticipants.id })
    .from(stageParticipants)
    .where(
      and(
        eq(stageParticipants.stageId, stageId),
        eq(stageParticipants.agentId, agent.id),
      ),
    )
    .limit(1)

  if (!participant) {
    return Response.json(
      { error: 'Agent is not a participant in this stage' },
      { status: 403 },
    )
  }

  const types = parseEventTypesParam(url.searchParams.get('types'))
  if (!types) {
    return Response.json(
      {
        error:
          'types required (comma-separated: dialogue,scene_change,twist)',
      },
      { status: 400 },
    )
  }

  const limit = parseEventsLimit(url.searchParams.get('limit'))
  const since = url.searchParams.get('since')

  const result = await queryFilteredStageEvents({
    stageId,
    types,
    since,
    limit,
  })

  if ('error' in result && result.error === 'invalid_since') {
    return Response.json({ error: 'invalid since (event id or ISO timestamp)' }, { status: 400 })
  }

  return Response.json({
    stageId,
    events: result.events.map((e) => ({
      id: e.id,
      stageId: e.stageId,
      type: e.type,
      agentId: e.agentId,
      characterId: e.characterId,
      content: e.content,
      createdAt: e.createdAt?.toISOString() ?? null,
    })),
  })
}

function handleStageEventsSse(request: Request, stageId: string) {
  const encoder = new TextEncoder()
  const stream = new TransformStream<Uint8Array, Uint8Array>()
  const writer = stream.writable.getWriter()

  const sendEvent = async (type: string, data: object) => {
    try {
      await writer.write(
        encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`),
      )
    } catch {
      // Writer may be closed
    }
  }

  // Cursor by createdAt (not event id — UUID order ≠ chronological order).
  // Also track lastSentEventId: JS Date is ms-precision, so gt(createdAt) can re-match
  // the same row when Postgres stores sub-ms timestamps.
  let lastCreatedAt: Date | null = null
  let lastSentEventId: string | null = null

  void (async () => {
    const [newest] = await db
      .select({ id: stageEvents.id, createdAt: stageEvents.createdAt })
      .from(stageEvents)
      .where(eq(stageEvents.stageId, stageId))
      .orderBy(desc(stageEvents.createdAt))
      .limit(1)

    if (newest?.createdAt) {
      lastCreatedAt = newest.createdAt
    }
    if (newest?.id) {
      lastSentEventId = newest.id
    }

    await sendEvent('connected', {
      stageId,
      timestamp: new Date().toISOString(),
    })

    const intervalId = setInterval(async () => {
      try {
        const conditions = [eq(stageEvents.stageId, stageId)]
        if (lastCreatedAt) {
          conditions.push(gt(stageEvents.createdAt, lastCreatedAt))
        }
        if (lastSentEventId) {
          conditions.push(ne(stageEvents.id, lastSentEventId))
        }

        const newEvents = await db
          .select()
          .from(stageEvents)
          .where(and(...conditions))
          .orderBy(asc(stageEvents.createdAt))
          .limit(50)

        for (const event of newEvents) {
          await sendEvent(event.type, {
            id: event.id,
            stageId: event.stageId,
            type: event.type,
            agentId: event.agentId,
            characterId: event.characterId,
            content: event.content,
            createdAt: event.createdAt,
          })
          if (event.createdAt) {
            lastCreatedAt = event.createdAt
          }
          lastSentEventId = event.id
        }
      } catch {
        // DB may be unavailable transiently
      }
    }, 2000)

    request.signal.addEventListener('abort', () => {
      clearInterval(intervalId)
      writer.close().catch(() => {})
    })
  })()

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
