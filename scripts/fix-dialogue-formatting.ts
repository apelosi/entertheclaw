/**
 * Repair dialogue lines where quoted speech was incorrectly left inside [brackets]
 * or [inline directions] were nested inside quotes.
 *
 * Dry-run by default. Pass --yes to write updates.
 *
 *   bun run db:fix-dialogue-formatting
 *   DATABASE_URL='postgresql://...' bun run db:fix-dialogue-formatting -- --yes
 *   bun run --no-env-file db:fix-dialogue-formatting -- --database-url='postgresql://...' --yes
 *
 * Review helpers:
 *   --full              print complete before/after lines (not just the change region)
 *   --export=repairs.jsonl   write every repair as JSONL for offline review
 */
import * as dotenv from 'dotenv'
import * as fs from 'node:fs'
dotenv.config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { and, eq } from 'drizzle-orm'
import { stageEvents, stages } from '../lib/db/schema'
import { changeSnippet, firstDiffIndex, repairDialogueFormatting } from '../lib/stage/dialogue-format'

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

const EXPORT_PATH = (() => {
  const prefix = '--export='
  const arg = process.argv.find((a) => a.startsWith(prefix))
  return arg ? arg.slice(prefix.length).trim() : null
})()

const APPLY = process.argv.includes('--yes')
const FULL = process.argv.includes('--full')

function logRepair(
  stageName: string,
  eventId: string,
  before: string,
  after: string,
): void {
  console.log(`\n  ${stageName} — ${eventId}`)
  if (FULL) {
    console.log(`    before: ${before}`)
    console.log(`    after:  ${after}`)
    return
  }
  const snippet = changeSnippet(before, after)
  console.log(`    before: ${snippet.before}`)
  console.log(`    after:  ${snippet.after}`)
}

async function main() {
  const db = drizzle(neon(readDatabaseUrl()))
  const apply = APPLY

  console.log(apply ? 'Mode: APPLY (--yes)' : 'Mode: DRY RUN (pass --yes to write)')
  if (STAGE_FILTER) console.log(`Stage filter: ${STAGE_FILTER}`)
  if (FULL) console.log('Output: full lines (--full)')
  if (EXPORT_PATH) console.log(`Export: ${EXPORT_PATH}`)

  const stageRows = STAGE_FILTER
    ? await db.select().from(stages).where(eq(stages.name, STAGE_FILTER))
    : await db.select({ id: stages.id, name: stages.name }).from(stages)

  let scanned = 0
  let repaired = 0
  const exportRows: Array<{
    stage: string
    eventId: string
    before: string
    after: string
    changeAt: number
  }> = []

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
      logRepair(stage.name, row.id, c.text, fixed)

      if (EXPORT_PATH) {
        exportRows.push({
          stage: stage.name,
          eventId: row.id,
          before: c.text,
          after: fixed,
          changeAt: firstDiffIndex(c.text, fixed),
        })
      }

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

  if (EXPORT_PATH && exportRows.length > 0) {
    const body = exportRows.map((r) => JSON.stringify(r)).join('\n') + '\n'
    fs.writeFileSync(EXPORT_PATH, body, 'utf8')
    console.log(`\nWrote ${exportRows.length} repair(s) to ${EXPORT_PATH}`)
  }

  console.log(
    `\nDone. Scanned ${scanned} dialogue line(s); ${repaired} need repair${apply ? ' (updated)' : ' (dry run)'}.`,
  )
  if (!FULL && !EXPORT_PATH && repaired > 0) {
    console.log(
      'Tip: re-run with --full for complete lines, or --export=repairs.jsonl to review offline.',
    )
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('fix-dialogue-formatting failed:', err)
  process.exit(1)
})
