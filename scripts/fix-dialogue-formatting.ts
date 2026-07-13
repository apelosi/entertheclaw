/**
 * Repair dialogue lines (prep + Class A/B/C/D/E/F formatting).
 *
 * Prep: strip etc_emote/etc_speak leakage; normalize smart quotes + stored \" escapes;
 *       unwrap mistaken leading "; convert outer-"…'speech'" wraps; strip trailing junk
 * Class E: reverse inverted speech-in-brackets mangling
 * Class C: bracket stage direction / quote bare speech between spoken quotes
 * Class A: close [brackets] before quoted speech trapped inside them
 * Class B: unwrap short [emphasis] inside quotes → plain spoken words
 * Class F: split `"Speech. [action] More."` into separate quote spans
 * Class D: balance missing closing quotes; trim trailing quote garbage
 *
 * Also reclassifies emote rows that contain spoken dialogue (isEmote → dialogue).
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
import {
  analyzeDialogueRepair,
  emoteContainsDialogue,
  firstDiffIndex,
  normalizeEmoteAction,
} from '../lib/stage/dialogue-format'

function readDatabaseUrl(): string {
  const prefix = '--database-url='
  const arg = process.argv.find((a) => a.startsWith(prefix))
  const url = (arg ? arg.slice(prefix.length) : process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL)?.trim()
  if (!url) {
    throw new Error('Set DATABASE_URL or pass --database-url=...')
  }
  // Neon HTTP driver requires a Latin-1 URL. Unicode ellipsis (…) from chat
  // placeholders, smart quotes, or non-ASCII passwords fail with ByteString errors.
  for (let i = 0; i < url.length; i++) {
    const code = url.charCodeAt(i)
    if (code > 255) {
      const ch = url[i]
      const name = code === 0x2026 ? 'ellipsis (…) — did you paste a placeholder URL?' : `U+${code.toString(16).toUpperCase()}`
      throw new Error(
        `DATABASE_URL has a non-ASCII character at index ${i}: ${name}.\n` +
          'Use a plain ASCII postgres URL. Do not copy "…" placeholders from chat.',
      )
    }
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

function repairRow(content: Record<string, unknown>): {
  text: string
  isEmote: boolean
  analysis: ReturnType<typeof analyzeDialogueRepair> | null
  reclassified: boolean
} | null {
  if (typeof content.text !== 'string') return null
  const wasEmote = content.isEmote === true

  if (wasEmote) {
    if (!emoteContainsDialogue(content.text)) {
      const normalized = normalizeEmoteAction(content.text)
      if (normalized === content.text) return null
      return {
        text: normalized,
        isEmote: true,
        analysis: null,
        reclassified: false,
      }
    }
    const analysis = analyzeDialogueRepair(content.text)
    return {
      text: analysis.after,
      isEmote: false,
      analysis,
      reclassified: true,
    }
  }

  const analysis = analyzeDialogueRepair(content.text)
  if (analysis.after === content.text) return null
  return {
    text: analysis.after,
    isEmote: false,
    analysis,
    reclassified: false,
  }
}

function logRepair(
  stageName: string,
  eventId: string,
  before: string,
  after: string,
  flags: {
    prep?: boolean
    classA?: boolean
    classB?: boolean
    classC?: boolean
    classD?: boolean
    classE?: boolean
    classF?: boolean
    reclassified?: boolean
  },
): void {
  const tags = [
    flags.reclassified ? 'reclassified emote→dialogue' : null,
    flags.prep ? 'Prep' : null,
    flags.classE ? 'Class E' : null,
    flags.classC ? 'Class C' : null,
    flags.classA ? 'Class A' : null,
    flags.classB ? 'Class B' : null,
    flags.classF ? 'Class F' : null,
    flags.classD ? 'Class D' : null,
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

  if (STAGE_FILTER && stageRows.length === 0) {
    const allNames = await db.select({ name: stages.name }).from(stages)
    const names = allNames.map((r) => r.name).sort()
    throw new Error(
      `No stage named ${JSON.stringify(STAGE_FILTER)}.\n` +
        `Exact names:\n  - ${names.join('\n  - ')}\n` +
        `Tip: use --stage='Claw of the Titans' (include "the").`,
    )
  }

  let scanned = 0
  let repaired = 0
  let prepCount = 0
  let classACount = 0
  let classBCount = 0
  let classCCount = 0
  let classDCount = 0
  let classECount = 0
  let classFCount = 0
  let reclassifiedCount = 0
  const exportRows: Array<{
    stage: string
    eventId: string
    before: string
    after: string
    prep: boolean
    classA: boolean
    classB: boolean
    classC: boolean
    classD: boolean
    classE: boolean
    classF: boolean
    reclassified: boolean
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
      if (typeof c.text !== 'string') continue
      scanned++

      const result = repairRow(c)
      if (!result) continue

      repaired++
      if (result.reclassified) reclassifiedCount++
      if (result.analysis?.prep) prepCount++
      if (result.analysis?.classA) classACount++
      if (result.analysis?.classB) classBCount++
      if (result.analysis?.classC) classCCount++
      if (result.analysis?.classD) classDCount++
      if (result.analysis?.classE) classECount++
      if (result.analysis?.classF) classFCount++

      logRepair(stage.name, row.id, c.text, result.text, {
        prep: result.analysis?.prep,
        classA: result.analysis?.classA,
        classB: result.analysis?.classB,
        classC: result.analysis?.classC,
        classD: result.analysis?.classD,
        classE: result.analysis?.classE,
        classF: result.analysis?.classF,
        reclassified: result.reclassified,
      })

      if (EXPORT_PATH) {
        exportRows.push({
          stage: stage.name,
          eventId: row.id,
          before: c.text,
          after: result.text,
          prep: result.analysis?.prep ?? false,
          classA: result.analysis?.classA ?? false,
          classB: result.analysis?.classB ?? false,
          classC: result.analysis?.classC ?? false,
          classD: result.analysis?.classD ?? false,
          classE: result.analysis?.classE ?? false,
          classF: result.analysis?.classF ?? false,
          reclassified: result.reclassified,
          changeAt: firstDiffIndex(c.text, result.text),
        })
      }

      if (apply) {
        const nextContent: Record<string, unknown> = {
          ...c,
          text: result.text,
          isEmote: result.isEmote,
        }
        if (!result.isEmote) {
          delete nextContent.isEmote
        }
        if (typeof c.safeText === 'string') {
          nextContent.safeText = c.safeText.replace(c.text, result.text)
        }
        await db
          .update(stageEvents)
          .set({ content: nextContent })
          .where(eq(stageEvents.id, row.id))
      }
    }
  }

  if (EXPORT_PATH && exportRows.length > 0) {
    const body = exportRows.map((r) => JSON.stringify(r)).join('\n') + '\n'
    fs.writeFileSync(EXPORT_PATH, body, 'utf8')
    console.log(`\nWrote ${exportRows.length} repair(s) to ${EXPORT_PATH}`)
  }

  console.log(`\nDone. Scanned ${scanned} dialogue row(s).`)
  console.log(`  Rows changed:     ${repaired}${apply ? ' (updated)' : ' (dry run)'}`)
  console.log(`  Reclassified:     ${reclassifiedCount} emote→dialogue`)
  console.log(`  Prep:             ${prepCount}`)
  console.log(`  Class E:          ${classECount}`)
  console.log(`  Class C:          ${classCCount}`)
  console.log(`  Class A:          ${classACount}`)
  console.log(`  Class B:          ${classBCount}`)
  console.log(`  Class F:          ${classFCount}`)
  console.log(`  Class D:          ${classDCount}`)
  process.exit(0)
}

main().catch((err) => {
  console.error('fix-dialogue-formatting failed:', err)
  process.exit(1)
})
