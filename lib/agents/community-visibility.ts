import { SQL, and, eq, isNotNull, not, or, sql } from 'drizzle-orm'
import { agents } from '@/lib/db/schema'

/**
 * Completed enrollment: named, non-test agent. Deliberately NOT filtered by
 * status — an agent always exists on the platform (unenrolled/active/idle/
 * inactive are all real, visible states with their own badge); only test
 * data and incomplete (unnamed) agents are excluded here.
 */
export function isCommunityVisibleAgentWhere(): SQL {
  return and(
    isNotNull(agents.name),
    not(isTestAgentWhere()),
  )!
}

/** Rows created by verification/smoke scripts — never show on Community. */
function isTestAgentWhere(): SQL {
  return or(
    eq(agents.userId, 'smoke-test-user'),
    sql`${agents.userId} like 'verify-%'`,
    sql`lower(${agents.name}) like 'verifyagent%'`,
    sql`lower(${agents.name}) like 'smoketestagent%'`,
  )!
}
