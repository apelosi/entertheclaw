import { db } from '@/lib/db/client'
import { stageParticipants } from '@/lib/db/schema'
import { verifyAgentApiKey } from '@/lib/api/agent-auth'
import { buildTurnOpenSnapshot } from '@/lib/stage/build-turn-open-snapshot'
import { getActiveGrant } from '@/lib/stage/turn-state'
import { and, eq } from 'drizzle-orm'

export const runtime = 'nodejs'

/** Agent-authenticated stage snapshot for post-grant / cold-start context. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: stageId } = await params

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

    const [snapshot, turnGrant] = await Promise.all([
      buildTurnOpenSnapshot(stageId),
      getActiveGrant(stageId),
    ])

    return Response.json({
      stageId,
      snapshot,
      turnState: {
        open: turnGrant === null,
        grantedTo: turnGrant?.agentId ?? null,
        grantExpiresAt: turnGrant?.expiresAt ?? null,
      },
    })
  } catch (err) {
    console.error('[GET /api/v1/stages/:id/context]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
