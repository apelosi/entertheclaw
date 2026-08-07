import { generateApiKey, getApiKeyPrefix, hashApiKey } from '@/lib/api/agent-auth'
import {
  deleteOtherPendingEnrollments,
  findPendingEnrollment,
} from '@/lib/agents/pending-enrollment'
import { db } from '@/lib/db/client'
import { agents } from '@/lib/db/schema'
import { and, eq, isNotNull } from 'drizzle-orm'

export type IssuedInviteKey = {
  agent: typeof agents.$inferSelect
  rawKey: string
  prefix: string
  reusedPendingEnrollment: boolean
  reusedExistingAgent: boolean
}

/**
 * Issue a one-time raw API key.
 * - reuseAgentId set → rotate onto that named row owned by userId (no new Community card)
 * - else → reuse one unnamed pending row, or insert a new pending enrollment
 */
export async function issueAgentInviteKey(input: {
  userId: string
  targetStageId: string | null
  reuseAgentId: string | null
}): Promise<IssuedInviteKey> {
  const rawKey = generateApiKey()
  const hash = hashApiKey(rawKey)
  const prefix = getApiKeyPrefix(rawKey)
  const keyFields = {
    apiKeyHash: hash,
    apiKeyPrefix: prefix,
    targetStageId: input.targetStageId,
    enrolledAt: new Date(),
  }

  if (input.reuseAgentId) {
    const [existing] = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.id, input.reuseAgentId),
          eq(agents.userId, input.userId),
          isNotNull(agents.name),
        ),
      )
      .limit(1)

    if (!existing?.name?.trim()) {
      throw new InviteKeyIssueError(
        'Agent not found, not yours, or still pending enrollment',
        404,
      )
    }

    const [agent] = await db
      .update(agents)
      .set(keyFields)
      .where(eq(agents.id, existing.id))
      .returning()

    await deleteOtherPendingEnrollments(input.userId, agent.id)

    return {
      agent,
      rawKey,
      prefix,
      reusedPendingEnrollment: false,
      reusedExistingAgent: true,
    }
  }

  const pending = await findPendingEnrollment(input.userId)
  const agent = pending
    ? (
        await db
          .update(agents)
          .set(keyFields)
          .where(eq(agents.id, pending.id))
          .returning()
      )[0]
    : (
        await db
          .insert(agents)
          .values({
            userId: input.userId,
            apiKeyHash: hash,
            apiKeyPrefix: prefix,
            status: 'unenrolled',
            targetStageId: input.targetStageId,
          })
          .returning()
      )[0]

  return {
    agent,
    rawKey,
    prefix,
    reusedPendingEnrollment: Boolean(pending),
    reusedExistingAgent: false,
  }
}

export class InviteKeyIssueError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'InviteKeyIssueError'
    this.status = status
  }
}
