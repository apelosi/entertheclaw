import { db } from '@/lib/db/client'
import { stageEvents, stageParticipants } from '@/lib/db/schema'
import { verifyAgentApiKey } from '@/lib/api/agent-auth'
import { and, desc, eq, inArray } from 'drizzle-orm'

// Node runtime required: verifyAgentApiKey uses Node crypto for API key hashing.
export const runtime = 'nodejs'

// Event types streamed to authenticated agent runtimes. We omit turn_claim
// because it's noisy and only relevant to the claim resolver itself, and we
// omit movement which agents don't need to react to. Joined/left/character_ready
// are useful "the cast changed" signals so we include them.
type AgentEventType =
  | 'dialogue'
  | 'twist'
  | 'scene_change'
  | 'turn_open'
  | 'turn_grant'
  | 'joined'
  | 'left'
  | 'character_ready'
  | 'absence_narrative'
  | 'promoted'

const AGENT_EVENT_TYPES: AgentEventType[] = [
  'dialogue',
  'twist',
  'scene_change',
  'turn_open',
  'turn_grant',
  'joined',
  'left',
  'character_ready',
  'absence_narrative',
  'promoted',
]

const POLL_INTERVAL_MS = 2000
const KEEPALIVE_INTERVAL_MS = 15_000

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: stageId } = await params

  const agent = await verifyAgentApiKey(request)
  if (!agent) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Verify the agent participates in this stage
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
    return new Response('Not a participant in this stage', { status: 403 })
  }

  // Cost telemetry: agent SSE connections are long-lived and bill for their
  // full open duration (GB-Hrs) — the dominant Functions compute driver. Log
  // open/close so Netlify function logs reveal per-agent connection lifetime.
  const sseOpenedAt = Date.now()
  console.log(`[sse:agent] open stage=${stageId} agent=${agent.id}`)
  const encoder = new TextEncoder()
  const stream = new TransformStream<Uint8Array, Uint8Array>()
  const writer = stream.writable.getWriter()

  const sendEvent = async (type: string, data: object) => {
    try {
      await writer.write(
        encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`),
      )
    } catch {
      // writer may be closed
    }
  }

  // Seed lastEventId so we don't replay history.
  let lastEventId: string | null = null
  const [latestEvent] = await db
    .select({ id: stageEvents.id })
    .from(stageEvents)
    .where(
      and(
        eq(stageEvents.stageId, stageId),
        inArray(stageEvents.type, AGENT_EVENT_TYPES),
      ),
    )
    .orderBy(desc(stageEvents.createdAt))
    .limit(1)

  if (latestEvent) lastEventId = latestEvent.id

  await sendEvent('connected', {
    stageId,
    agentId: agent.id,
    timestamp: new Date().toISOString(),
  })

  const pollId = setInterval(async () => {
    try {
      const newEvents = await db
        .select()
        .from(stageEvents)
        .where(
          and(
            eq(stageEvents.stageId, stageId),
            inArray(stageEvents.type, AGENT_EVENT_TYPES),
          ),
        )
        .orderBy(desc(stageEvents.createdAt))
        .limit(20)

      const toSend: typeof newEvents = []
      for (const event of newEvents) {
        if (lastEventId && event.id === lastEventId) break
        toSend.push(event)
      }
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
      // DB transient error — next tick will retry
    }
  }, POLL_INTERVAL_MS)

  // Keepalive comments so proxies don't kill the connection
  const keepaliveId = setInterval(() => {
    writer.write(encoder.encode(`: keepalive\n\n`)).catch(() => {})
  }, KEEPALIVE_INTERVAL_MS)

  request.signal.addEventListener('abort', () => {
    clearInterval(pollId)
    clearInterval(keepaliveId)
    writer.close().catch(() => {})
    console.log(
      `[sse:agent] close stage=${stageId} agent=${agent.id} durationMs=${Date.now() - sseOpenedAt}`,
    )
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
