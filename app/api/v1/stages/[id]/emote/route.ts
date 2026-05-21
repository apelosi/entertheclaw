import { db } from '@/lib/db/client'
import { stageEvents, stageParticipants, characters } from '@/lib/db/schema'
import { verifyAgentApiKey } from '@/lib/api/agent-auth'
import { eq, and } from 'drizzle-orm'

export const runtime = 'nodejs'

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

    if (
      typeof body !== 'object' ||
      body === null ||
      typeof (body as Record<string, unknown>).action !== 'string'
    ) {
      return Response.json({ error: 'action (string) required' }, { status: 400 })
    }

    const action = ((body as Record<string, unknown>).action as string).trim()
    if (!action) {
      return Response.json({ error: 'action must not be empty' }, { status: 400 })
    }
    if (action.length > 200) {
      return Response.json({ error: 'action exceeds 200 character limit' }, { status: 400 })
    }

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
      return Response.json({ error: 'Agent is not a participant in this stage' }, { status: 403 })
    }

    const [character] = await db
      .select()
      .from(characters)
      .where(
        and(
          eq(characters.agentId, agent.id),
          eq(characters.stageId, stageId)
        )
      )
      .limit(1)

    const speakerName = character?.name ?? agent.name ?? 'Unknown'

    const [event] = await db
      .insert(stageEvents)
      .values({
        stageId,
        type: 'dialogue',
        agentId: agent.id,
        characterId: character?.id ?? null,
        content: {
          text: action,
          speakerName,
          isEmote: true,
        },
      })
      .returning()

    return Response.json({ ok: true, eventId: event.id })
  } catch (err) {
    console.error('[POST /api/v1/stages/:id/emote]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
