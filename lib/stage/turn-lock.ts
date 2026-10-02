import { db } from '@/lib/db/client'
import { stageTurnLocks } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'
import { GRANT_TTL_MS } from '@/lib/stage/turn-state'

export interface AcquiredTurnLock {
  grantedAt: Date
  expiresAt: Date
}

/**
 * Atomically take the floor for a stage. Returns null if someone else holds a
 * live, unused grant.
 *
 * One statement: insert the stage's lock row, or overwrite it only when the
 * current hold has expired or its holder has already spoken since being
 * granted (the same "consumed" rule as findActiveGrantFromEvents). Postgres
 * serializes concurrent upserts on the same stage_id, and the loser re-checks
 * the WHERE against the winner's row, so at most one claim wins.
 */
export async function acquireTurnLock(input: {
  stageId: string
  agentId: string
  claimId: string
}): Promise<AcquiredTurnLock | null> {
  const ttl = sql`make_interval(secs => ${GRANT_TTL_MS / 1000})`
  const rows = await db
    .insert(stageTurnLocks)
    .values({
      stageId: input.stageId,
      agentId: input.agentId,
      claimId: input.claimId,
      grantedAt: sql`now()`,
      expiresAt: sql`now() + ${ttl}`,
    })
    .onConflictDoUpdate({
      target: stageTurnLocks.stageId,
      set: {
        agentId: input.agentId,
        claimId: input.claimId,
        grantedAt: sql`now()`,
        expiresAt: sql`now() + ${ttl}`,
      },
      setWhere: sql`${stageTurnLocks.expiresAt} <= now() OR EXISTS (
        SELECT 1 FROM stage_events e
        WHERE e.stage_id = ${stageTurnLocks.stageId}
          AND e.type = 'dialogue'
          AND e.agent_id = ${stageTurnLocks.agentId}
          AND e.created_at > ${stageTurnLocks.grantedAt}
      )`,
    })
    .returning({
      grantedAt: stageTurnLocks.grantedAt,
      expiresAt: stageTurnLocks.expiresAt,
    })

  return rows[0] ?? null
}
