/**
 * Insert a missing scene_change row for a director twist that explicitly
 * relocated the scene but the classifier did not persist one.
 *
 * Usage:
 *   bun run db:backfill-scene-change -- --dry-run
 *   bun run db:backfill-scene-change -- --yes
 *
 * Production (uses .env.production.local when present):
 *   dotenv -e .env.production.local -- bun run db:backfill-scene-change -- --yes
 *
 * Or pass an explicit branch:
 *   bun run --no-env-file db:backfill-scene-change -- --database-url='postgresql://...' --yes
 */
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.production.local' })
dotenv.config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { and, eq } from 'drizzle-orm'
import { stageEvents, stages } from '../lib/db/schema'
import { buildSceneFallbackFromTwistText } from '../lib/stage/twist-scene-fallback'
import { parseDbHost } from '../lib/db/database-url'

const CLAW_WARS_STAGE_ID = 'da3fdb31-5764-4d2e-9544-2dca4cf64452'
const CLAW_WARS_TWIST_EVENT_ID = '659dd26b-ed7c-43fd-a9e4-c69442ad8edd'

function readFlag(name: string): boolean {
  return process.argv.includes(name)
}

function readDatabaseUrl(): string {
  const prefix = '--database-url='
  const arg = process.argv.find((a) => a.startsWith(prefix))
  if (arg) return arg.slice(prefix.length).trim()
  const url = process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL
  if (!url) {
    throw new Error(
      'No database URL. Set DATABASE_URL / NEON_DATABASE_URL or pass --database-url=',
    )
  }
  return url
}

async function main() {
  const dryRun = !readFlag('--yes')
  const databaseUrl = readDatabaseUrl()
  console.log(`Target: ${parseDbHost(databaseUrl)}`)
  console.log(dryRun ? 'Mode: dry-run (pass --yes to write)' : 'Mode: apply')

  const db = drizzle(neon(databaseUrl))
  const sql = neon(databaseUrl)

  const [twistRow] = await sql`
    SELECT id, stage_id, type, content, created_at::text AS created_at
    FROM stage_events
    WHERE id = ${CLAW_WARS_TWIST_EVENT_ID}
    LIMIT 1
  `

  if (!twistRow || twistRow.type !== 'twist') {
    throw new Error(`Twist event ${CLAW_WARS_TWIST_EVENT_ID} not found`)
  }

  if (twistRow.stage_id !== CLAW_WARS_STAGE_ID) {
    throw new Error(
      `Twist stage ${twistRow.stage_id} does not match expected ${CLAW_WARS_STAGE_ID}`,
    )
  }

  const twistContent =
    typeof twistRow.content === 'object' && twistRow.content !== null
      ? (twistRow.content as Record<string, unknown>)
      : null
  const twistText = typeof twistContent?.text === 'string' ? twistContent.text : ''
  if (!twistText) throw new Error('Twist event has no text content')

  const existing = await db
    .select({ id: stageEvents.id })
    .from(stageEvents)
    .where(
      and(
        eq(stageEvents.stageId, CLAW_WARS_STAGE_ID),
        eq(stageEvents.type, 'scene_change'),
      ),
    )

  for (const row of existing) {
    const [full] = await db
      .select({ content: stageEvents.content })
      .from(stageEvents)
      .where(eq(stageEvents.id, row.id))
      .limit(1)
    const c = full?.content as Record<string, unknown> | null
    if (c?.sourceEventId === CLAW_WARS_TWIST_EVENT_ID) {
      console.log(`Already backfilled (scene_change ${row.id}). Nothing to do.`)
      return
    }
  }

  const scene = buildSceneFallbackFromTwistText(twistText)
  if (!scene) {
    throw new Error('Twist text does not look like an explicit scene relocation')
  }

  const twistAt = new Date(String(twistRow.created_at))
  const createdAtIso = new Date(twistAt.getTime() + 1_000).toISOString()

  const payload = {
    stageId: CLAW_WARS_STAGE_ID,
    type: 'scene_change' as const,
    content: {
      name: scene.name,
      description: scene.description,
      reason: scene.reason,
      sourceEventId: CLAW_WARS_TWIST_EVENT_ID,
      sourceType: 'twist' as const,
    },
  }

  const [stage] = await db
    .select({ name: stages.name })
    .from(stages)
    .where(eq(stages.id, CLAW_WARS_STAGE_ID))
    .limit(1)

  console.log(`Stage: ${stage?.name ?? CLAW_WARS_STAGE_ID}`)
  console.log(`Twist: ${twistText.slice(0, 120)}…`)
  console.log(`Scene name: ${scene.name}`)
  console.log(`Scene description: ${scene.description}`)
  console.log(`createdAt: ${createdAtIso} (1s after twist via SQL interval)`)

  if (dryRun) {
    console.log('\nDry run complete. Re-run with --yes to insert.')
    return
  }

  const [inserted] = await sql`
    INSERT INTO stage_events (stage_id, type, content, created_at)
    VALUES (
      ${CLAW_WARS_STAGE_ID},
      'scene_change',
      ${JSON.stringify(payload.content)}::jsonb,
      (SELECT created_at + interval '1 second' FROM stage_events WHERE id = ${CLAW_WARS_TWIST_EVENT_ID})
    )
    RETURNING id
  `

  console.log(`\n✓ Inserted scene_change ${inserted.id}`)
}

main().catch((err) => {
  console.error('backfill-missed-scene-change failed:', err)
  process.exit(1)
})
