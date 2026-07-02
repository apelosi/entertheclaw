import { and, eq, isNull, lt, ne } from 'drizzle-orm'
import { PENDING_INVITE_TTL_MS } from '@/lib/agents/pending-invite-constants'
import { db } from '@/lib/db/client'
import { agents } from '@/lib/db/schema'

export function pendingInviteCutoff(): Date {
  return new Date(Date.now() - PENDING_INVITE_TTL_MS)
}

/** API key issued but agent runtime has not called POST /api/v1/agents yet. */
export function isPendingEnrollment(agent: {
  name: string | null
  status: string | null
}): boolean {
  return !agent.name?.trim() && agent.status === 'unenrolled'
}

export function isPendingInviteExpired(agent: {
  name: string | null
  status: string | null
  enrolledAt: Date | null
}): boolean {
  if (!isPendingEnrollment(agent)) return false
  if (!agent.enrolledAt) return true
  return agent.enrolledAt < pendingInviteCutoff()
}

export async function deleteExpiredPendingEnrollments(userId?: string): Promise<number> {
  const deleted = await db
    .delete(agents)
    .where(
      and(
        isNull(agents.name),
        eq(agents.status, 'unenrolled'),
        lt(agents.enrolledAt, pendingInviteCutoff()),
        userId ? eq(agents.userId, userId) : undefined,
      ),
    )
    .returning({ id: agents.id })

  return deleted.length
}

export async function findPendingEnrollment(userId: string) {
  await deleteExpiredPendingEnrollments(userId)

  const [row] = await db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.userId, userId),
        isNull(agents.name),
        eq(agents.status, 'unenrolled'),
      ),
    )
    .limit(1)

  return row ?? null
}

/** Remove duplicate pending rows after a successful enroll (same user, other ids). */
export async function deleteOtherPendingEnrollments(
  userId: string,
  keepAgentId: string,
): Promise<number> {
  const deleted = await db
    .delete(agents)
    .where(
      and(
        eq(agents.userId, userId),
        isNull(agents.name),
        eq(agents.status, 'unenrolled'),
        ne(agents.id, keepAgentId),
      ),
    )
    .returning({ id: agents.id })

  return deleted.length
}
