/**
 * Set `stages.created_at` to the catalog date (2026-05-22 noon UTC) for all rows.
 * Idempotent — safe to re-run.
 *
 * Run: `bun run db:set-stage-created-at`
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { sql } from 'drizzle-orm'
import { stages } from '../lib/db/schema'
import { STAGE_CREATED_AT } from '../lib/db/stage-created-at'

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  const db = drizzle(neon(process.env.DATABASE_URL))

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(stages)

  const updated = await db
    .update(stages)
    .set({ createdAt: STAGE_CREATED_AT })
    .returning({ id: stages.id })

  console.log(
    `Updated created_at for ${updated.length} stage(s) (of ${count} total) to ${STAGE_CREATED_AT.toISOString()}`,
  )
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
