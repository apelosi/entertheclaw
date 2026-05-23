/**
 * Maintenance: backdate opening scene_change events so they sort as oldest in
 * script history, and remove stray test twists.
 *
 * Run: `bun run db:fix-script-history`
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { and, asc, eq, ne, or, sql } from 'drizzle-orm'
import { stageEvents, stages, twists } from '../lib/db/schema'

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  const db = drizzle(neon(process.env.DATABASE_URL))

  const allStages = await db
    .select({
      id: stages.id,
      name: stages.name,
      createdAt: stages.createdAt,
    })
    .from(stages)

  let scenesBackdated = 0

  for (const stage of allStages) {
    const [opening] = await db
      .select()
      .from(stageEvents)
      .where(
        and(
          eq(stageEvents.stageId, stage.id),
          eq(stageEvents.type, 'scene_change'),
        ),
      )
      .orderBy(asc(stageEvents.createdAt))
      .limit(1)

    if (!opening) continue

    const [earliestOther] = await db
      .select({ createdAt: stageEvents.createdAt })
      .from(stageEvents)
      .where(
        and(
          eq(stageEvents.stageId, stage.id),
          ne(stageEvents.id, opening.id),
          or(eq(stageEvents.type, 'dialogue'), eq(stageEvents.type, 'twist')),
        ),
      )
      .orderBy(asc(stageEvents.createdAt))
      .limit(1)

    const anchor = stage.createdAt ?? earliestOther?.createdAt ?? opening.createdAt ?? new Date()

    let target = new Date(anchor)
    if (earliestOther?.createdAt) {
      const otherMs = new Date(earliestOther.createdAt).getTime()
      if (target.getTime() >= otherMs) {
        target = new Date(otherMs - 1000)
      }
    }

    const openingMs = opening.createdAt
      ? new Date(opening.createdAt).getTime()
      : Date.now()
    if (openingMs <= target.getTime()) continue

    await db
      .update(stageEvents)
      .set({ createdAt: target })
      .where(eq(stageEvents.id, opening.id))

    console.log(`  ✓ ${stage.name} — opening scene backdated to ${target.toISOString()}`)
    scenesBackdated++
  }

  const testTwistRows = await db
    .select({ id: twists.id, stageId: twists.stageId })
    .from(twists)
    .where(eq(twists.content, '321321'))

  let twistsDeleted = 0
  for (const row of testTwistRows) {
    await db.delete(twists).where(eq(twists.id, row.id))
    await db
      .delete(stageEvents)
      .where(
        and(
          eq(stageEvents.stageId, row.stageId),
          eq(stageEvents.type, 'twist'),
          sql`${stageEvents.content}->>'text' = '321321'`,
        ),
      )
    console.log(`  ✓ Deleted test twist "321321" on stage ${row.stageId}`)
    twistsDeleted++
  }

  console.log(`\nDone. Backdated ${scenesBackdated} opening scene(s); deleted ${twistsDeleted} test twist(s).`)
  process.exit(0)
}

main().catch((err) => {
  console.error('fix-stage-script-history failed:', err)
  process.exit(1)
})
