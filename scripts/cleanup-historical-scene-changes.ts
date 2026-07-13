/**
 * Audit and remove overzealous scene_change rows using post-PR-#80 logic.
 * Optionally backfill missed relocations (e.g. Clawfather hospital).
 *
 * Usage:
 *   bun run db:cleanup-historical-scenes -- --dry-run
 *   bun run db:cleanup-historical-scenes -- --yes
 *   bun run db:cleanup-historical-scenes -- --database-url='postgresql://...' --yes
 *
 * Production:
 *   dotenv -e .env.production.local -- bun run db:cleanup-historical-scenes -- --yes
 */
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.production.local' })
dotenv.config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-http'
import { stageEvents, stages } from '../lib/db/schema'
import { parseDbHost } from '../lib/db/database-url'
import {
  auditHistoricalSceneChange,
  detectMissedSceneChange,
} from '../lib/stage/evaluate-historical-scene-change'

const TARGET_STAGE_NAMES = [
  'Claw Wars',
  'The Clawfather',
  'Claw of the Titans',
] as const

type Row = {
  id: string
  stageId: string
  stageName: string
  type: string
  content: Record<string, unknown>
  createdAt: Date
}

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

function asContent(row: Row): Record<string, unknown> {
  return typeof row.content === 'object' && row.content !== null
    ? row.content
    : {}
}

function eventText(content: Record<string, unknown>): string {
  return typeof content.text === 'string' ? content.text.trim() : ''
}

async function main() {
  const dryRun = !readFlag('--yes')
  const databaseUrl = readDatabaseUrl()
  console.log(`Target: ${parseDbHost(databaseUrl)}`)
  console.log(dryRun ? 'Mode: dry-run (pass --yes to apply)' : 'Mode: apply\n')

  const db = drizzle(neon(databaseUrl))
  const sql = neon(databaseUrl)

  const targetStages = await db
    .select({ id: stages.id, name: stages.name })
    .from(stages)
    .where(inArray(stages.name, [...TARGET_STAGE_NAMES]))

  if (targetStages.length !== TARGET_STAGE_NAMES.length) {
    const found = targetStages.map((s) => s.name)
    const missing = TARGET_STAGE_NAMES.filter((n) => !found.includes(n))
    throw new Error(`Missing stages: ${missing.join(', ')}`)
  }

  const toDelete: Array<{
    id: string
    stageName: string
    name: string
    auditReason: string
    createdAt: string
  }> = []

  const toInsert: Array<{
    stageId: string
    stageName: string
    sourceEventId: string
    createdAt: string
    content: Record<string, unknown>
  }> = []

  for (const stage of targetStages) {
    const rows = await db
      .select({
        id: stageEvents.id,
        stageId: stageEvents.stageId,
        type: stageEvents.type,
        content: stageEvents.content,
        createdAt: stageEvents.createdAt,
      })
      .from(stageEvents)
      .where(
        and(
          eq(stageEvents.stageId, stage.id),
          inArray(stageEvents.type, ['dialogue', 'twist', 'scene_change']),
        ),
      )
      .orderBy(asc(stageEvents.createdAt))

    const events: Row[] = rows.map((r) => ({
      ...r,
      stageName: stage.name,
      content: (r.content ?? {}) as Record<string, unknown>,
      createdAt: r.createdAt ?? new Date(0),
    }))

    let currentScene = {
      name: 'The stage',
      description: '',
    }

    console.log(`\n=== ${stage.name} (${events.length} script events) ===`)

    // Pass 1: audit persisted scene_change rows
    for (const event of events) {
      if (event.type !== 'scene_change') continue

      const c = asContent(event)
      const name = typeof c.name === 'string' ? c.name : ''
      const description =
        typeof c.description === 'string' ? c.description : ''
      const reason = typeof c.reason === 'string' ? c.reason : ''
      const sourceEventId =
        typeof c.sourceEventId === 'string' ? c.sourceEventId : undefined
      const sourceType =
        c.sourceType === 'dialogue' || c.sourceType === 'twist'
          ? c.sourceType
          : undefined
      const isOpeningScene =
        reason.toLowerCase().includes('opening scene') || !sourceEventId

      if (isOpeningScene || !sourceEventId) {
        console.log(
          `KEEP ${event.createdAt.toISOString().slice(0, 19)} | ${name} (opening)`,
        )
        currentScene = { name, description }
        continue
      }

      const source = events.find((e) => e.id === sourceEventId)
      const sourceText = source ? eventText(asContent(source)) : ''
      const audit = auditHistoricalSceneChange({
        currentScene,
        sourceKind: sourceType ?? 'dialogue',
        sourceText,
        proposedName: name,
        proposedDescription: description,
        proposedReason: reason,
      })

      console.log(
        `${audit.keep ? 'KEEP' : 'DELETE'} ${event.createdAt.toISOString().slice(0, 19)} | ${name}`,
      )
      console.log(`  audit: ${audit.reason}`)
      console.log(`  before: ${currentScene.name}`)

      if (!audit.keep) {
        toDelete.push({
          id: event.id,
          stageName: stage.name,
          name,
          auditReason: audit.reason,
          createdAt: event.createdAt.toISOString(),
        })
        continue
      }

      currentScene = { name, description }
    }

    const deleteIds = new Set(
      toDelete.filter((d) => d.stageName === stage.name).map((d) => d.id),
    )

    // Pass 2: missed backfills using kept scene timeline only
    currentScene = { name: 'The stage', description: '' }
    let hasHospitalScene = false

    for (const event of events) {
      if (event.type === 'scene_change') {
        if (deleteIds.has(event.id)) continue
        const c = asContent(event)
        const name = typeof c.name === 'string' ? c.name : ''
        const description =
          typeof c.description === 'string' ? c.description : ''
        if (/hospital/i.test(name)) hasHospitalScene = true
        currentScene = { name, description }
        continue
      }

      if (event.type !== 'dialogue' && event.type !== 'twist') continue
      if (hasHospitalScene) continue

      const text = eventText(asContent(event))
      if (!text) continue

      const missed = detectMissedSceneChange(currentScene, event.type, text)
      if (!missed) continue

      const createdAt = new Date(event.createdAt.getTime() + 1_000)
      toInsert.push({
        stageId: stage.id,
        stageName: stage.name,
        sourceEventId: event.id,
        createdAt: createdAt.toISOString(),
        content: {
          name: missed.suggestedName,
          description: missed.suggestedDescription,
          reason: 'Backfill: hospital corridor established in bracket staging.',
          sourceEventId: event.id,
          sourceType: event.type,
          backfill: true,
        },
      })
      hasHospitalScene = true
      currentScene = {
        name: missed.suggestedName,
        description: missed.suggestedDescription,
      }
      console.log(
        `BACKFILL ${stage.name} @ ${event.createdAt.toISOString().slice(0, 19)} → ${missed.suggestedName}`,
      )
    }
  }

  console.log('\n--- Summary ---')
  console.log(`Delete: ${toDelete.length}`)
  for (const d of toDelete) {
    console.log(`  ${d.stageName} ${d.id} (${d.auditReason}) ${d.name}`)
  }
  console.log(`Insert: ${toInsert.length}`)
  for (const i of toInsert) {
    console.log(`  ${i.stageName} after ${i.sourceEventId} → ${i.content.name}`)
  }

  if (dryRun) {
    console.log('\nDry run complete. Re-run with --yes to apply.')
    return
  }

  if (toDelete.length > 0) {
    await db
      .delete(stageEvents)
      .where(
        inArray(
          stageEvents.id,
          toDelete.map((d) => d.id),
        ),
      )
    console.log(`\n✓ Deleted ${toDelete.length} scene_change row(s)`)
  }

  for (const row of toInsert) {
    const [inserted] = await sql`
      INSERT INTO stage_events (stage_id, type, content, created_at)
      VALUES (
        ${row.stageId},
        'scene_change',
        ${JSON.stringify(row.content)}::jsonb,
        ${row.createdAt}::timestamptz
      )
      RETURNING id
    `
    console.log(`✓ Inserted backfill scene_change ${inserted.id} (${row.stageName})`)
  }

  if (toDelete.length === 0 && toInsert.length === 0) {
    console.log('\nNothing to change.')
  }
}

main().catch((err) => {
  console.error('cleanup-historical-scene-changes failed:', err)
  process.exit(1)
})
