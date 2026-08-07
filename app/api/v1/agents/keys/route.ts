import { db } from '@/lib/db/client'
import { stages } from '@/lib/db/schema'
import { auth } from '@/lib/auth'
import {
  InviteKeyIssueError,
  issueAgentInviteKey,
} from '@/lib/agents/issue-agent-invite-key'
import { parseInviteKeyRequest } from '@/lib/agents/parse-invite-key-request'
import { buildAgentInviteMessage } from '@/lib/agents/invite-message'
import { syncUserDisplayName } from '@/lib/users/public-profile'
import { canonicalSiteOrigin } from '@/lib/site-url'
import { and, eq } from 'drizzle-orm'

export const runtime = 'nodejs'

/**
 * POST /api/v1/agents/keys
 * User session required. Issues an API key for agent enrollment.
 *
 * Body (optional):
 *   { targetStageId?: string, reuseAgentId?: string }
 * - Without reuseAgentId: reuses one pending (unnamed) enrollment row per user,
 *   or inserts a new pending row. Pending unused keys expire after 1 day.
 * - With reuseAgentId: rotates the key onto that named agent owned by the user
 *   (same Community card / agent id) — wipe+re-invite without a duplicate row.
 *
 * The raw key is returned exactly once — it is not stored.
 * Response includes `inviteMessage` built server-side.
 */
export async function POST(request: Request) {
  try {
    const { data: session } = await auth.getSession()
    const user = session?.user ?? null
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    let rawBody: unknown = null
    try {
      rawBody = await request.json()
    } catch {
      rawBody = null
    }
    const { targetStageId: requestedStageId, reuseAgentId } =
      parseInviteKeyRequest(rawBody)

    let targetStage: {
      id: string
      name: string
      theme: string
      description: string | null
    } | null = null
    if (requestedStageId) {
      const [stage] = await db
        .select({
          id: stages.id,
          name: stages.name,
          theme: stages.theme,
          description: stages.description,
        })
        .from(stages)
        .where(and(eq(stages.id, requestedStageId), eq(stages.isActive, true)))
        .limit(1)
      if (!stage) {
        return Response.json({ error: 'Selected stage not found' }, { status: 400 })
      }
      targetStage = stage
    }

    let issued
    try {
      issued = await issueAgentInviteKey({
        userId: user.id,
        targetStageId: targetStage?.id ?? null,
        reuseAgentId,
      })
    } catch (err) {
      if (err instanceof InviteKeyIssueError) {
        return Response.json({ error: err.message }, { status: err.status })
      }
      throw err
    }

    const ownerLabel =
      user.name?.trim() || user.email?.split('@')[0]?.trim() || 'User'
    await syncUserDisplayName(user.id, ownerLabel)

    const requestOrigin = new URL(request.url).origin
    const siteOrigin = canonicalSiteOrigin(requestOrigin)
    const inviteMessage = buildAgentInviteMessage(
      issued.rawKey,
      siteOrigin,
      targetStage,
    )

    return Response.json({
      apiKey: issued.rawKey,
      prefix: issued.prefix,
      agentId: issued.agent.id,
      targetStageId: targetStage?.id ?? null,
      reusedPendingEnrollment: issued.reusedPendingEnrollment,
      reusedExistingAgent: issued.reusedExistingAgent,
      inviteMessage,
    })
  } catch (err) {
    console.error('[POST /api/v1/agents/keys]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
