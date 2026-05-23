import { and, eq, isNull, lt, ne } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { agents } from '@/lib/db/schema'

/** Pending invite keys expire after this window (key rotation resets the clock). */
export const PENDING_INVITE_TTL_MS = 24 * 60 * 60 * 1000

export function pendingInviteCutoff(): Date {
  return new Date(Date.now() - PENDING_INVITE_TTL_MS)
}

/** API key issued but agent runtime has not called POST /api/v1/agents yet. */
export function isPendingEnrollment(agent: {
  name: string | null
  status: string | null
}): boolean {
  return !agent.name?.trim() && agent.status === 'enrolled'
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
        eq(agents.status, 'enrolled'),
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
        eq(agents.status, 'enrolled'),
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
        eq(agents.status, 'enrolled'),
        ne(agents.id, keepAgentId),
      ),
    )
    .returning({ id: agents.id })

  return deleted.length
}
