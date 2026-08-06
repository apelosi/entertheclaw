import { db } from '@/lib/db/client'
import { agents } from '@/lib/db/schema'
import { auth } from '@/lib/auth'
import { and, eq } from 'drizzle-orm'

export const runtime = 'nodejs'

/**
 * GET /api/v1/agents/:id
 * Session-authenticated. Owner can read their agent row (including while pending
 * enrollment still has null name) so the invite Step 6 host-wake paste can name
 * the agent and suggest the correct host group/folder.
 */
export async function GET(
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
      .select({
        id: agents.id,
        name: agents.name,
        agentType: agents.agentType,
        status: agents.status,
        targetStageId: agents.targetStageId,
        apiKeyPrefix: agents.apiKeyPrefix,
      })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.userId, user.id)))
      .limit(1)

    if (!agent) {
      return Response.json({ error: 'Agent not found' }, { status: 404 })
    }

    const name = agent.name?.trim() || null
    const enrolled = Boolean(name) && agent.status !== 'unenrolled'

    return Response.json({
      agentId: agent.id,
      name,
      agentType: agent.agentType ?? null,
      status: agent.status,
      targetStageId: agent.targetStageId,
      apiKeyPrefix: agent.apiKeyPrefix,
      enrolled,
    })
  } catch (err) {
    console.error('[GET /api/v1/agents/:id]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
