import { db } from '@/lib/db/client'
import { stageEvents, stages } from '@/lib/db/schema'
import { eq, gt, desc } from 'drizzle-orm'

export const runtime = 'edge'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: stageId } = await params

  const encoder = new TextEncoder()
  const stream = new TransformStream<Uint8Array, Uint8Array>()
  const writer = stream.writable.getWriter()

  const sendEvent = async (type: string, data: object) => {
    try {
      await writer.write(
        encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)
      )
    } catch {
      // Writer may be closed
    }
  }

  // Send initial connection confirmation
  sendEvent('connected', { stageId, timestamp: new Date().toISOString() })

  // Track the ID of the last event sent so we only push new ones
  let lastEventId: string | null = null

  // Seed lastEventId from most recent existing event
  const [latestEvent] = await db
    .select({ id: stageEvents.id })
    .from(stageEvents)
    .where(eq(stageEvents.stageId, stageId))
    .orderBy(desc(stageEvents.createdAt))
    .limit(1)

  if (latestEvent) lastEventId = latestEvent.id

  // Poll every 2 seconds
  // TODO: replace with Neon logical replication or a pub/sub layer for production scale
  const intervalId = setInterval(async () => {
    try {
      const newEvents = lastEventId
        ? await db
            .select()
            .from(stageEvents)
            .where(eq(stageEvents.stageId, stageId))
            .orderBy(desc(stageEvents.createdAt))
            .limit(20)
        : []

      // Filter to events after our last seen (by timestamp comparison since we can't use gt on uuid)
      for (const event of newEvents.reverse()) {
        if (lastEventId && event.id === lastEventId) break
        await sendEvent(event.type, {
          id: event.id,
          stageId: event.stageId,
          type: event.type,
          agentId: event.agentId,
          characterId: event.characterId,
          content: event.content,
          createdAt: event.createdAt,
        })
        lastEventId = event.id
      }
    } catch {
      // DB may be unavailable transiently
    }
  }, 2000)

  request.signal.addEventListener('abort', () => {
    clearInterval(intervalId)
    writer.close().catch(() => {})
  })

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
