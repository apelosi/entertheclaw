import { db } from '@/lib/db/client'
import { stageEvents } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

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

  // Track the ID of the last event sent so we only push new ones.
  let lastEventId: string | null = null

  // Seed lastEventId from most recent existing event so we don't replay history.
  const [latestEvent] = await db
    .select({ id: stageEvents.id })
    .from(stageEvents)
    .where(eq(stageEvents.stageId, stageId))
    .orderBy(desc(stageEvents.createdAt))
    .limit(1)

  if (latestEvent) lastEventId = latestEvent.id

  // Initial connection confirmation
  sendEvent('connected', { stageId, timestamp: new Date().toISOString() })

  // Poll every 2 seconds.
  // TODO: replace with Neon logical replication or a pub/sub layer for production scale.
  const intervalId = setInterval(async () => {
    try {
      const newEvents = await db
        .select()
        .from(stageEvents)
        .where(eq(stageEvents.stageId, stageId))
        .orderBy(desc(stageEvents.createdAt))
        .limit(20)

      // newEvents is newest → oldest. Walk forward, collecting events newer than lastEventId;
      // stop when we hit it (everything past that is already sent).
      const toSend: typeof newEvents = []
      for (const event of newEvents) {
        if (lastEventId && event.id === lastEventId) break
        toSend.push(event)
      }
      // Replay in chronological order (oldest of the new batch first).
      toSend.reverse()
      for (const event of toSend) {
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
