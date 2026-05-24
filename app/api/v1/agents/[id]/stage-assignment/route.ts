import { db } from '@/lib/db/client'
import { agents } from '@/lib/db/schema'
import { auth } from '@/lib/auth'
import { and, eq } from 'drizzle-orm'
import { after } from 'next/server'
import {
  enrollAgentOnStage,
  getAgentCurrentStageId,
  unenrollAgentFromStage,
} from '@/lib/stages/enrollment'
import { generateCharacterAssets } from '@/lib/characters/generate-character-assets'

export const runtime = 'nodejs'

/**
 * PUT /api/v1/agents/[id]/stage-assignment
 * Body: { stageId: string }
 * Session-authenticated. The signed-in user must own the agent.
 *
 * Behavior:
 *   - If agent is not on any stage: enroll on `stageId`.
 *   - If agent is already on `stageId`: no-op, returns current assignment.
 *   - If agent is on a different stage: archive that character (reason
 *     'user_pulled') and enroll on `stageId` atomically.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: agentId } = await params

    const { data: session } = await auth.getSession()
    const user = session?.user ?? null
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    let body: { stageId?: unknown } | null = null
    try {
      body = (await request.json()) as { stageId?: unknown }
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const stageId =
      body && typeof body.stageId === 'string' && body.stageId.trim()
        ? body.stageId.trim()
        : null
    if (!stageId) {
      return Response.json({ error: 'stageId is required' }, { status: 400 })
    }

    const [agent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.userId, user.id)))
      .limit(1)
    if (!agent) {
      return Response.json({ error: 'Agent not found' }, { status: 404 })
    }
    if (!agent.name?.trim()) {
      return Response.json(
        { error: 'Agent has not completed enrollment yet' },
        { status: 400 },
      )
    }

    const currentStageId = await getAgentCurrentStageId(agent.id)
    if (currentStageId && currentStageId !== stageId) {
      await unenrollAgentFromStage({
        agentId: agent.id,
        stageId: currentStageId,
        reason: 'user_pulled',
      })
    }

    const result = await enrollAgentOnStage({
      agentId: agent.id,
      agentName: agent.name,
      stageId,
    })

    if (!result.ok) {
      if (result.error.kind === 'stage_not_found') {
        return Response.json({ error: 'Stage not found or inactive' }, { status: 404 })
      }
      if (result.error.kind === 'stage_full') {
        return Response.json({ error: 'Stage is at capacity' }, { status: 409 })
      }
      return Response.json({ error: 'Failed to enroll agent' }, { status: 500 })
    }

    const data = result.data
    if (!data.alreadyOnStage) {
      const generationCharacterId = data.characterId
      const generationIsMain = data.isMain
      after(async () => {
        try {
          await generateCharacterAssets({
            characterId: generationCharacterId,
            isMain: generationIsMain,
          })
        } catch (err) {
          console.error('[stage-assignment PUT] asset generation failed', err)
        }
      })
    }

    return Response.json({
      ok: true,
      stageId,
      role: data.role,
      participantId: data.participantId,
      characterId: data.characterId,
      alreadyOnStage: data.alreadyOnStage,
      transferredFromStageId: currentStageId && currentStageId !== stageId ? currentStageId : null,
    })
  } catch (err) {
    console.error('[PUT /api/v1/agents/:id/stage-assignment]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/v1/agents/[id]/stage-assignment
 * Session-authenticated. Pulls the agent off whichever stage they are on.
 * Archives the character to archived_characters with reason 'user_pulled'.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: agentId } = await params

    const { data: session } = await auth.getSession()
    const user = session?.user ?? null
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    const [agent] = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.userId, user.id)))
      .limit(1)
    if (!agent) {
      return Response.json({ error: 'Agent not found' }, { status: 404 })
    }

    const result = await unenrollAgentFromStage({
      agentId: agent.id,
      reason: 'user_pulled',
    })

    return Response.json({
      ok: true,
      removed: result.removed,
      archivedCharacterId: result.archivedCharacterId,
    })
  } catch (err) {
    console.error('[DELETE /api/v1/agents/:id/stage-assignment]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
