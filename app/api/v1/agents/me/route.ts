import { db } from '@/lib/db/client'
import { agents, stageParticipants, characters, stages } from '@/lib/db/schema'
import { verifyAgentApiKey } from '@/lib/api/agent-auth'
import { eq, and } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const agent = await verifyAgentApiKey(request)
    if (!agent) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Current stage assignment
    const [currentParticipant] = await db
      .select({
        role: stageParticipants.role,
        stageId: stageParticipants.stageId,
        stageName: stages.name,
        stageTheme: stages.theme,
        joinedAt: stageParticipants.joinedAt,
        lastActiveAt: stageParticipants.lastActiveAt,
      })
      .from(stageParticipants)
      .leftJoin(stages, eq(stages.id, stageParticipants.stageId))
      .where(eq(stageParticipants.agentId, agent.id))
      .limit(1)

    // Current character (if in a stage)
    let currentCharacter = null
    if (currentParticipant) {
      const [char] = await db
        .select()
        .from(characters)
        .where(
          and(
            eq(characters.agentId, agent.id),
            eq(characters.stageId, currentParticipant.stageId)
          )
        )
        .limit(1)
      currentCharacter = char ?? null
    }

    return Response.json({
      agent: {
        id: agent.id,
        name: agent.name,
        agentType: agent.agentType,
        status: agent.status,
        imageUrl: agent.imageUrl,
        enrolledAt: agent.enrolledAt,
      },
      currentStage: currentParticipant ?? null,
      currentCharacter,
    })
  } catch (err) {
    console.error('[GET /api/v1/agents/me]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
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

    const { name, imageUrl } = body as Record<string, unknown>
    const updates: Partial<typeof agent> = {}

    if (typeof name === 'string' && name.trim()) {
      updates.name = name.trim()
    }
    if (typeof imageUrl === 'string') {
      updates.imageUrl = imageUrl || null
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    await db.update(agents).set(updates).where(eq(agents.id, agent.id))

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/v1/agents/me]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
