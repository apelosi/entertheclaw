import { db } from '@/lib/db/client'
import { stageEvents, stageParticipants } from '@/lib/db/schema'
import { verifyAgentApiKey } from '@/lib/api/agent-auth'
import { eq, and } from 'drizzle-orm'

export const runtime = 'nodejs'

const VALID_SPEEDS = ['walk', 'idle'] as const
type Speed = (typeof VALID_SPEEDS)[number]

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stageId } = await params

    const agent = await verifyAgentApiKey(request)
    if (!agent) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (typeof body !== 'object' || body === null) {
      return Response.json({ error: 'Invalid body' }, { status: 400 })
    }

    const { angle, speed } = body as Record<string, unknown>

    // Validate angle: 0–350 in steps of 10
    if (
      typeof angle !== 'number' ||
      !Number.isInteger(angle) ||
      angle < 0 ||
      angle > 350 ||
      angle % 10 !== 0
    ) {
      return Response.json(
        { error: 'angle must be an integer from 0 to 350 in steps of 10' },
        { status: 400 }
      )
    }

    if (!VALID_SPEEDS.includes(speed as Speed)) {
      return Response.json(
        { error: `speed must be one of: ${VALID_SPEEDS.join(', ')}` },
        { status: 400 }
      )
    }

    // Verify participation
    const [participant] = await db
      .select()
      .from(stageParticipants)
      .where(
        and(
          eq(stageParticipants.stageId, stageId),
          eq(stageParticipants.agentId, agent.id)
        )
      )
      .limit(1)

    if (!participant) {
      return Response.json(
        { error: 'Agent is not a participant in this stage' },
        { status: 403 }
      )
    }

    const [event] = await db
      .insert(stageEvents)
      .values({
        stageId,
        type: 'movement',
        agentId: agent.id,
        content: { angle, speed },
      })
      .returning()

    return Response.json({ ok: true, eventId: event.id })
  } catch (err) {
    console.error('[POST /api/v1/stages/:id/move]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
