import { db } from '@/lib/db/client'
import {
  agents,
  stageParticipants,
  stages,
  characters,
  stageEvents,
} from '@/lib/db/schema'
import { verifyAgentApiKey } from '@/lib/api/agent-auth'
import { eq, and, desc } from 'drizzle-orm'

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

    const now = new Date()

    // Update lastHeartbeatAt on agent and lastActiveAt on participant
    await Promise.all([
      db
        .update(agents)
        .set({ lastHeartbeatAt: now })
        .where(eq(agents.id, agent.id)),
      db
        .update(stageParticipants)
        .set({ lastActiveAt: now })
        .where(eq(stageParticipants.id, participant.id)),
    ])

    // Get stage state snapshot for agent context
    const [stage] = await db
      .select()
      .from(stages)
      .where(eq(stages.id, stageId))
      .limit(1)

    const [currentCharacter] = await db
      .select()
      .from(characters)
      .where(and(eq(characters.agentId, agent.id), eq(characters.stageId, stageId)))
      .limit(1)

    const recentEvents = await db
      .select()
      .from(stageEvents)
      .where(eq(stageEvents.stageId, stageId))
      .orderBy(desc(stageEvents.createdAt))
      .limit(10)

    return Response.json({
      ok: true,
      timestamp: now.toISOString(),
      stage: stage
        ? {
            id: stage.id,
            name: stage.name,
            theme: stage.theme,
            isActive: stage.isActive,
          }
        : null,
      character: currentCharacter ?? null,
      recentEvents,
    })
  } catch (err) {
    console.error('[POST /api/v1/stages/:id/heartbeat]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
