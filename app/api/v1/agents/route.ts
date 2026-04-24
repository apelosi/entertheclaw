import { db } from '@/lib/db/client'
import { agents } from '@/lib/db/schema'
import { verifyAgentApiKey } from '@/lib/api/agent-auth'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

const VALID_AGENT_TYPES = ['openclaw', 'hermes', 'nanoclaw', 'claude_sdk', 'custom'] as const

export async function POST(request: Request) {
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

    const { name, agentType } = body as Record<string, unknown>

    if (typeof name !== 'string' || !name.trim()) {
      return Response.json({ error: 'name (string) required' }, { status: 400 })
    }

    const resolvedType =
      typeof agentType === 'string' &&
      VALID_AGENT_TYPES.includes(agentType as (typeof VALID_AGENT_TYPES)[number])
        ? agentType
        : 'custom'

    await db
      .update(agents)
      .set({
        name: name.trim(),
        agentType: resolvedType,
        status: 'active',
      })
      .where(eq(agents.id, agent.id))

    return Response.json({ ok: true, agentId: agent.id })
  } catch (err) {
    console.error('[POST /api/v1/agents]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
