/**
 * Repair dialogue lines where quoted speech was incorrectly left inside [brackets]
 * or [inline directions] were nested inside quotes.
 *
 * Dry-run by default. Pass --yes to write updates.
 *
 *   bun run db:fix-dialogue-formatting
 *   DATABASE_URL='postgresql://...' bun run db:fix-dialogue-formatting -- --yes
 *   bun run --no-env-file db:fix-dialogue-formatting -- --database-url='postgresql://...' --yes
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { and, eq } from 'drizzle-orm'
import { stageEvents, stages } from '../lib/db/schema'
import { repairDialogueFormatting } from '../lib/stage/dialogue-format'

function readDatabaseUrl(): string {
  const prefix = '--database-url='
  const arg = process.argv.find((a) => a.startsWith(prefix))
  if (arg) return arg.slice(prefix.length).trim()
  const url = process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL
  if (!url) {
    throw new Error('Set DATABASE_URL or pass --database-url=...')
  }
  return url
}

const STAGE_FILTER = (() => {
  const prefix = '--stage='
  const arg = process.argv.find((a) => a.startsWith(prefix))
  return arg ? arg.slice(prefix.length).trim() : null
})()

const APPLY = process.argv.includes('--yes')

async function main() {
  const db = drizzle(neon(readDatabaseUrl()))
  const apply = APPLY

  console.log(apply ? 'Mode: APPLY (--yes)' : 'Mode: DRY RUN (pass --yes to write)')
  if (STAGE_FILTER) console.log(`Stage filter: ${STAGE_FILTER}`)

  const stageRows = STAGE_FILTER
    ? await db.select().from(stages).where(eq(stages.name, STAGE_FILTER))
    : await db.select({ id: stages.id, name: stages.name }).from(stages)

  let scanned = 0
  let repaired = 0

  for (const stage of stageRows) {
    const events = await db
      .select({ id: stageEvents.id, content: stageEvents.content })
      .from(stageEvents)
      .where(and(eq(stageEvents.stageId, stage.id), eq(stageEvents.type, 'dialogue')))

    for (const row of events) {
      if (typeof row.content !== 'object' || row.content === null) continue
      const c = row.content as Record<string, unknown>
      if (c.isEmote === true) continue
      if (typeof c.text !== 'string') continue
      scanned++

      const fixed = repairDialogueFormatting(c.text)
      if (fixed === c.text) continue

      repaired++
      console.log(`\n  ${stage.name} — ${row.id.slice(0, 8)}`)
      console.log(`    before: ${c.text.slice(0, 100)}${c.text.length > 100 ? '…' : ''}`)
      console.log(`    after:  ${fixed.slice(0, 100)}${fixed.length > 100 ? '…' : ''}`)

      if (apply) {
        await db
          .update(stageEvents)
          .set({
            content: {
              ...c,
              text: fixed,
              ...(typeof c.safeText === 'string'
                ? { safeText: c.safeText.replace(c.text, fixed) }
                : {}),
            },
          })
          .where(eq(stageEvents.id, row.id))
      }
    }
  }

  console.log(
    `\nDone. Scanned ${scanned} dialogue line(s); ${repaired} need repair${apply ? ' (updated)' : ' (dry run)'}.`,
  )
  process.exit(0)
}

main().catch((err) => {
  console.error('fix-dialogue-formatting failed:', err)
  process.exit(1)
})
