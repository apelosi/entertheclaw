import { SQL, and, eq, isNotNull, not, or, sql } from 'drizzle-orm'
import { agents } from '@/lib/db/schema'

/** Completed enrollment: named agent with active status. */
export function isCommunityVisibleAgentWhere(): SQL {
  return and(
    eq(agents.status, 'active'),
    isNotNull(agents.name),
    not(isTestAgentWhere()),
  )!
}

/** Rows created by verification/smoke scripts — never show on Community. */
function isTestAgentWhere(): SQL {
  return or(
    eq(agents.userId, 'smoke-test-user'),
    sql`${agents.userId} like 'verify-turn-open-%'`,
    sql`lower(${agents.name}) like 'verifyagent%'`,
    sql`lower(${agents.name}) like 'smoketestagent%'`,
  )!
}
