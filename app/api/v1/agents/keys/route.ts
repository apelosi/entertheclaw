import { db } from '@/lib/db/client'
import { agents, stages } from '@/lib/db/schema'
import { auth } from '@/lib/auth'
import { generateApiKey, hashApiKey, getApiKeyPrefix } from '@/lib/api/agent-auth'
import { findPendingEnrollment } from '@/lib/agents/pending-enrollment'
import { syncUserDisplayName } from '@/lib/users/public-profile'
import { and, eq } from 'drizzle-orm'

export const runtime = 'nodejs'

/**
 * POST /api/v1/agents/keys
 * User session required. Issues an API key for agent enrollment.
 * Reuses one pending enrollment row per user (rotates the key, resets 24h TTL) so invite
 * does not stack orphan "Unnamed" agents. Pending invites expire after 1 day. The raw key
 * is returned exactly once — it is not stored.
 *
 * Optional body: { targetStageId: string }
 *   The stage the human assigned the agent to at invite time. The agent's
 *   runtime can read this via GET /api/v1/agents/me and join that stage.
 */
export async function POST(request: Request) {
  try {
    const { data: session } = await auth.getSession()
    const user = session?.user ?? null
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Body is optional — old callers send nothing.
    let body: { targetStageId?: unknown } | null = null
    try {
      body = (await request.json()) as { targetStageId?: unknown }
    } catch {
      body = null
    }

    let targetStageId: string | null = null
    if (body && typeof body.targetStageId === 'string' && body.targetStageId.trim()) {
      const requested = body.targetStageId.trim()
      const [stage] = await db
        .select({ id: stages.id })
        .from(stages)
        .where(and(eq(stages.id, requested), eq(stages.isActive, true)))
        .limit(1)
      if (!stage) {
        return Response.json({ error: 'Selected stage not found' }, { status: 400 })
      }
      targetStageId = stage.id
    }

    const rawKey = generateApiKey()
    const hash = hashApiKey(rawKey)
    const prefix = getApiKeyPrefix(rawKey)

    const pending = await findPendingEnrollment(user.id)

    const agent = pending
      ? (
          await db
            .update(agents)
            .set({
              apiKeyHash: hash,
              apiKeyPrefix: prefix,
              targetStageId,
              enrolledAt: new Date(),
            })
            .where(eq(agents.id, pending.id))
            .returning()
        )[0]
      : (
          await db
            .insert(agents)
            .values({
              userId: user.id,
              apiKeyHash: hash,
              apiKeyPrefix: prefix,
              status: 'enrolled',
              targetStageId,
            })
            .returning()
        )[0]

    const ownerLabel =
      user.name?.trim() || user.email?.split('@')[0]?.trim() || 'User'
    await syncUserDisplayName(user.id, ownerLabel)

    return Response.json({
      apiKey: rawKey,
      prefix,
      agentId: agent.id,
      targetStageId,
      reusedPendingEnrollment: Boolean(pending),
    })
  } catch (err) {
    console.error('[POST /api/v1/agents/keys]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
