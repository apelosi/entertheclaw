/**
 * Repair dialogue lines (Class A + Class B formatting).
 *
 * Class A: close [brackets] before quoted speech trapped inside them.
 * Class B: unwrap single-word [emphasis] inside quotes → plain spoken word.
 *
 * Dry-run by default. Pass --yes to write updates.
 *
 *   bun run db:fix-dialogue-formatting
 *   bun run --no-env-file db:fix-dialogue-formatting -- --database-url='postgresql://...'
 *   bun run --no-env-file db:fix-dialogue-formatting -- --database-url='postgresql://...' --yes
 *
 * Optional: --export=repairs.jsonl, --stage='Claw Wars'
 */
import * as dotenv from 'dotenv'
import * as fs from 'node:fs'
dotenv.config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { and, eq } from 'drizzle-orm'
import { stageEvents, stages } from '../lib/db/schema'
import { analyzeDialogueRepair, firstDiffIndex } from '../lib/stage/dialogue-format'

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

function logRepair(
  stageName: string,
  eventId: string,
  before: string,
  after: string,
  flags: { classA: boolean; classB: boolean },
): void {
  const tags = [
    flags.classA ? 'Class A' : null,
    flags.classB ? 'Class B' : null,
  ]
    .filter(Boolean)
    .join(', ')
  console.log(`\n  ${stageName} — ${eventId}${tags ? ` (${tags})` : ''}`)
  console.log(`    before: ${before}`)
  console.log(`    after:  ${after}`)
}

async function main() {
  const db = drizzle(neon(readDatabaseUrl()))
  const apply = APPLY

  console.log(apply ? 'Mode: APPLY (--yes)' : 'Mode: DRY RUN (pass --yes to write)')
  if (STAGE_FILTER) console.log(`Stage filter: ${STAGE_FILTER}`)
  if (EXPORT_PATH) console.log(`Export: ${EXPORT_PATH}`)

  const stageRows = STAGE_FILTER
    ? await db.select().from(stages).where(eq(stages.name, STAGE_FILTER))
    : await db.select({ id: stages.id, name: stages.name }).from(stages)

  let scanned = 0
  let repaired = 0
  let classACount = 0
  let classBCount = 0
  let bothCount = 0
  const exportRows: Array<{
    stage: string
    eventId: string
    before: string
    after: string
    classA: boolean
    classB: boolean
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

      const analysis = analyzeDialogueRepair(c.text)
      if (analysis.after === c.text) continue

      repaired++
      if (analysis.classA) classACount++
      if (analysis.classB) classBCount++
      if (analysis.classA && analysis.classB) bothCount++

      logRepair(stage.name, row.id, c.text, analysis.after, analysis)

      if (EXPORT_PATH) {
        exportRows.push({
          stage: stage.name,
          eventId: row.id,
          before: c.text,
          after: analysis.after,
          classA: analysis.classA,
          classB: analysis.classB,
          changeAt: firstDiffIndex(c.text, analysis.after),
        })
      }

      if (apply) {
        await db
          .update(stageEvents)
          .set({
            content: {
              ...c,
              text: analysis.after,
              ...(typeof c.safeText === 'string'
                ? { safeText: c.safeText.replace(c.text, analysis.after) }
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

  console.log(`\nDone. Scanned ${scanned} dialogue line(s).`)
  console.log(`  Rows changed:     ${repaired}${apply ? ' (updated)' : ' (dry run)'}`)
  console.log(`  Class A only:     ${classACount - bothCount}`)
  console.log(`  Class B only:     ${classBCount - bothCount}`)
  console.log(`  Both A + B:       ${bothCount}`)
  process.exit(0)
}

main().catch((err) => {
  console.error('fix-dialogue-formatting failed:', err)
  process.exit(1)
})
