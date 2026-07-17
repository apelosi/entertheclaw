/**
 * VV-10: replace evidenced Godfather IP strings in stages + stage_events
 * (+ character text fields if present), and log each correction to
 * copyright_remediations.
 *
 * Usage:
 *   bun run --no-env-file db:remediate-copyright -- --database-url='postgresql://...'
 *   bun run --no-env-file db:remediate-copyright -- --database-url='...' --apply
 *   bun run --no-env-file db:remediate-copyright -- --database-url='...' --apply --record-verified
 *
 * Dry-run by default. Pass --apply to write.
 * If data is already remidiated (leftovers=0) but copyright_remediations is empty,
 * pass --record-verified with --apply to insert verification audit rows.
 */
import { neon } from '@neondatabase/serverless'
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-http'
import { parseDbHost } from '../lib/db/database-url'
import {
  characters,
  copyrightRemediations,
  stageEvents,
  stages,
} from '../lib/db/schema'

/** Longer / phrase replacements first so nested substrings resolve correctly. */
const REPLACEMENTS: ReadonlyArray<{ oldValue: string; newValue: string }> = [
  { oldValue: 'the Turk', newValue: 'the Calabrian' },
  { oldValue: 'The Turk', newValue: 'The Calabrian' },
  { oldValue: 'Sollozzo', newValue: 'Venturini' },
  { oldValue: 'Bonasera', newValue: 'Morandi' },
  { oldValue: 'Tattaglia', newValue: 'Ferrante' },
  { oldValue: 'Barzini', newValue: 'Cattaneo' },
  { oldValue: 'Corleone', newValue: 'Santorelli' },
]

const CONTENT_MATCH =
  "(Corleone|Sollozzo|Bonasera|Tattaglia|Barzini|the Turk)"

type AuditInsert = typeof copyrightRemediations.$inferInsert

function readFlag(name: string): boolean {
  return process.argv.includes(name)
}

function readDatabaseUrl(): string {
  const prefix = '--database-url='
  const arg = process.argv.find((a) => a.startsWith(prefix))
  if (arg) {
    const value = arg.slice(prefix.length).trim()
    if (value) return value
  }
  throw new Error(
    'Missing --database-url=...\n\n' +
      'Example:\n' +
      "  bun run --no-env-file db:remediate-copyright -- --database-url='$NEON_DATABASE_URL_DEV' --apply",
  )
}

function environmentLabel(host: string): string {
  if (host.includes('muddy-wave')) return 'production'
  if (host.includes('polished-paper')) return 'dev'
  if (host.includes('fragrant-glitter')) return 'staging'
  return host
}

function replaceAllMapped(input: string): { text: string; changed: boolean } {
  let text = input
  for (const { oldValue, newValue } of REPLACEMENTS) {
    if (text.includes(oldValue)) {
      text = text.split(oldValue).join(newValue)
    }
  }
  return { text, changed: text !== input }
}

function rewriteJsonStrings(
  value: unknown,
): { value: unknown; changed: boolean } {
  if (typeof value === 'string') {
    const { text, changed } = replaceAllMapped(value)
    return { value: text, changed }
  }
  if (Array.isArray(value)) {
    let changed = false
    const next = value.map((item) => {
      const result = rewriteJsonStrings(item)
      if (result.changed) changed = true
      return result.value
    })
    return { value: next, changed }
  }
  if (value && typeof value === 'object') {
    let changed = false
    const next: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      const result = rewriteJsonStrings(child)
      if (result.changed) changed = true
      next[key] = result.value
    }
    return { value: next, changed }
  }
  return { value, changed: false }
}

function containsAnyOld(text: string): boolean {
  return REPLACEMENTS.some(({ oldValue }) => text.includes(oldValue))
}

function bumpPair(
  map: Map<
    string,
    {
      oldValue: string
      newValue: string
      count: number
      stageId: string | null
      stageName: string | null
    }
  >,
  oldValue: string,
  newValue: string,
  stageId: string | null,
  stageName: string | null,
) {
  const key = `${oldValue}→${newValue}`
  const entry = map.get(key) ?? {
    oldValue,
    newValue,
    count: 0,
    stageId,
    stageName,
  }
  entry.count += 1
  if (stageId) entry.stageId = stageId
  if (stageName) entry.stageName = stageName
  map.set(key, entry)
}

async function countNewValueHits(
  db: ReturnType<typeof drizzle>,
  newValue: string,
): Promise<number> {
  const stageHits = await db
    .select({
      initialSceneName: stages.initialSceneName,
      initialSceneDescription: stages.initialSceneDescription,
    })
    .from(stages)
  let count = 0
  for (const s of stageHits) {
    const blob = `${s.initialSceneName ?? ''}\n${s.initialSceneDescription ?? ''}`
    if (blob.includes(newValue)) count += 1
  }
  const eventHits = await db
    .select({ id: stageEvents.id })
    .from(stageEvents)
    .where(sql`${stageEvents.content}::text ILIKE ${'%' + newValue + '%'}`)
  count += eventHits.length
  return count
}

async function buildVerifiedAudits(
  db: ReturnType<typeof drizzle>,
  environment: string,
): Promise<AuditInsert[]> {
  const stageRows = await db
    .select({ id: stages.id, name: stages.name })
    .from(stages)
  const claw = stageRows.find((s) =>
    s.name.toLowerCase().includes('clawfather'),
  )

  // Deduplicate case variants (e.g. the Turk / The Turk)
  const seen = new Set<string>()
  const audits: AuditInsert[] = []
  for (const { oldValue, newValue } of REPLACEMENTS) {
    const key = oldValue.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const rowsAffected = await countNewValueHits(db, newValue)
    if (rowsAffected === 0) continue

    audits.push({
      stageId: claw?.id,
      stageName: claw?.name ?? null,
      oldValue,
      newValue,
      surface: 'verification',
      rowsAffected,
      environment,
      note: 'VV-10: leftovers=0; remediations already present; audit backfilled',
    })
  }
  return audits
}

async function main() {
  const apply = readFlag('--apply')
  const recordVerified = readFlag('--record-verified')
  const databaseUrl = readDatabaseUrl()
  const host = parseDbHost(databaseUrl)
  const environment = environmentLabel(host)

  console.log(`Target: ${host} (${environment})`)
  console.log(apply ? 'Mode: APPLY\n' : 'Mode: dry-run (pass --apply to write)\n')
  if (recordVerified) {
    console.log('Also: --record-verified (backfill audit if already clean)\n')
  }

  const client = neon(databaseUrl)
  const db = drizzle(client)
  const audits: AuditInsert[] = []

  const stageNameById = new Map(
    (
      await db.select({ id: stages.id, name: stages.name }).from(stages)
    ).map((s) => [s.id, s.name]),
  )

  // ── stages.initial_scene_* ──────────────────────────────────────────
  const allStages = await db
    .select({
      id: stages.id,
      name: stages.name,
      initialSceneName: stages.initialSceneName,
      initialSceneDescription: stages.initialSceneDescription,
    })
    .from(stages)

  const stageNameHits = new Map<
    string,
    {
      oldValue: string
      newValue: string
      count: number
      stageId: string | null
      stageName: string | null
    }
  >()
  const stageDescHits = new Map<
    string,
    {
      oldValue: string
      newValue: string
      count: number
      stageId: string | null
      stageName: string | null
    }
  >()

  let stagesUpdated = 0
  for (const stage of allStages) {
    for (const { oldValue, newValue } of REPLACEMENTS) {
      if (stage.initialSceneName?.includes(oldValue)) {
        bumpPair(stageNameHits, oldValue, newValue, stage.id, stage.name)
      }
      if (stage.initialSceneDescription?.includes(oldValue)) {
        bumpPair(stageDescHits, oldValue, newValue, stage.id, stage.name)
      }
    }

    const nameResult = stage.initialSceneName
      ? replaceAllMapped(stage.initialSceneName)
      : { text: stage.initialSceneName, changed: false }
    const descResult = stage.initialSceneDescription
      ? replaceAllMapped(stage.initialSceneDescription)
      : { text: stage.initialSceneDescription, changed: false }

    if (!nameResult.changed && !descResult.changed) continue

    console.log(
      `stages ${stage.name}: name=${nameResult.changed} desc=${descResult.changed}`,
    )
    stagesUpdated += 1
    if (apply) {
      await db
        .update(stages)
        .set({
          initialSceneName: nameResult.changed
            ? (nameResult.text as string)
            : stage.initialSceneName,
          initialSceneDescription: descResult.changed
            ? (descResult.text as string)
            : stage.initialSceneDescription,
        })
        .where(eq(stages.id, stage.id))
    }
  }

  console.log(`stages updated: ${stagesUpdated}`)

  for (const entry of stageNameHits.values()) {
    audits.push({
      stageId: entry.stageId ?? undefined,
      stageName: entry.stageName,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      surface: 'stages.initial_scene_name',
      rowsAffected: entry.count,
      environment,
      note: 'VV-10',
    })
  }
  for (const entry of stageDescHits.values()) {
    audits.push({
      stageId: entry.stageId ?? undefined,
      stageName: entry.stageName,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      surface: 'stages.initial_scene_description',
      rowsAffected: entry.count,
      environment,
      note: 'VV-10',
    })
  }

  // ── stage_events.content ────────────────────────────────────────────
  const eventRows = await db
    .select({
      id: stageEvents.id,
      stageId: stageEvents.stageId,
      content: stageEvents.content,
    })
    .from(stageEvents)
    .where(sql`${stageEvents.content}::text ~* ${CONTENT_MATCH}`)

  const eventHits = new Map<
    string,
    {
      oldValue: string
      newValue: string
      count: number
      stageId: string | null
      stageName: string | null
    }
  >()

  let eventsUpdated = 0
  for (const row of eventRows) {
    const content = (row.content ?? {}) as Record<string, unknown>
    const before = JSON.stringify(content)
    const stageName = stageNameById.get(row.stageId) ?? null
    for (const { oldValue, newValue } of REPLACEMENTS) {
      if (before.includes(oldValue)) {
        bumpPair(eventHits, oldValue, newValue, row.stageId, stageName)
      }
    }

    const { value, changed } = rewriteJsonStrings(content)
    if (!changed) continue
    eventsUpdated += 1
    if (apply) {
      await db
        .update(stageEvents)
        .set({ content: value as typeof stageEvents.$inferInsert.content })
        .where(eq(stageEvents.id, row.id))
    }
  }

  console.log(
    `stage_events matching: ${eventRows.length}, updated: ${eventsUpdated}`,
  )

  for (const entry of eventHits.values()) {
    audits.push({
      stageId: entry.stageId ?? undefined,
      stageName: entry.stageName,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      surface: 'stage_events.content',
      rowsAffected: entry.count,
      environment,
      note: 'VV-10 agent dialogue / scene_change text',
    })
  }

  // ── characters text fields ──────────────────────────────────────────
  const charRows = await db
    .select({
      id: characters.id,
      stageId: characters.stageId,
      name: characters.name,
      occupation: characters.occupation,
      appearance: characters.appearance,
      personality: characters.personality,
      backstory: characters.backstory,
      secrets: characters.secrets,
      fears: characters.fears,
      goals: characters.goals,
      speechPatterns: characters.speechPatterns,
      socialStatus: characters.socialStatus,
      memory: characters.memory,
      relationships: characters.relationships,
    })
    .from(characters)

  const charHits = new Map<
    string,
    {
      oldValue: string
      newValue: string
      count: number
      stageId: string | null
      stageName: string | null
    }
  >()

  let charsUpdated = 0
  for (const row of charRows) {
    const textFields = {
      name: row.name,
      occupation: row.occupation,
      appearance: row.appearance,
      personality: row.personality,
      backstory: row.backstory,
      secrets: row.secrets,
      fears: row.fears,
      goals: row.goals,
      speechPatterns: row.speechPatterns,
      socialStatus: row.socialStatus,
      memory: row.memory,
    }
    const blob =
      Object.values(textFields)
        .filter((v): v is string => typeof v === 'string')
        .join('\n') +
      '\n' +
      JSON.stringify(row.relationships ?? {})

    if (!containsAnyOld(blob)) continue

    const stageName = stageNameById.get(row.stageId) ?? null
    for (const { oldValue, newValue } of REPLACEMENTS) {
      if (blob.includes(oldValue)) {
        bumpPair(charHits, oldValue, newValue, row.stageId, stageName)
      }
    }

    const updates: Record<string, unknown> = {}
    let changed = false
    for (const [key, raw] of Object.entries(textFields)) {
      if (typeof raw !== 'string') continue
      const result = replaceAllMapped(raw)
      if (result.changed) {
        updates[key] = result.text
        changed = true
      }
    }
    if (row.relationships) {
      const relResult = rewriteJsonStrings(row.relationships)
      if (relResult.changed) {
        updates.relationships = relResult.value
        changed = true
      }
    }
    if (!changed) continue

    charsUpdated += 1
    if (apply) {
      await db.update(characters).set(updates).where(eq(characters.id, row.id))
    }
  }

  console.log(`characters updated: ${charsUpdated}`)
  for (const entry of charHits.values()) {
    audits.push({
      stageId: entry.stageId ?? undefined,
      stageName: entry.stageName,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      surface: 'characters.*',
      rowsAffected: entry.count,
      environment,
      note: 'VV-10 character bible / memory fields',
    })
  }

  console.log('\nAudit rows:')
  for (const a of audits) {
    console.log(
      `  [${a.surface}] ${a.oldValue} → ${a.newValue} (${a.rowsAffected} rows) @ ${a.stageName ?? '?'}`,
    )
  }

  if (audits.length === 0 && recordVerified) {
    const leftoverEvents = await db
      .select({ id: stageEvents.id })
      .from(stageEvents)
      .where(sql`${stageEvents.content}::text ~* ${CONTENT_MATCH}`)
    const allStagesCheck = await db
      .select({
        initialSceneName: stages.initialSceneName,
        initialSceneDescription: stages.initialSceneDescription,
      })
      .from(stages)
    const leftoverStageCount = allStagesCheck.filter(
      (s) =>
        containsAnyOld(s.initialSceneName ?? '') ||
        containsAnyOld(s.initialSceneDescription ?? ''),
    ).length

    if (leftoverEvents.length > 0 || leftoverStageCount > 0) {
      console.log(
        `\n--record-verified refused: leftovers remain (stage_events=${leftoverEvents.length}, stages=${leftoverStageCount})`,
      )
      process.exit(1)
    }

    const existing = await db
      .select({ id: copyrightRemediations.id })
      .from(copyrightRemediations)
      .where(eq(copyrightRemediations.environment, environment))
      .limit(1)

    if (existing.length > 0) {
      console.log(
        `\n--record-verified: audit rows already exist for environment=${environment}; skipping.`,
      )
    } else {
      const verified = await buildVerifiedAudits(db, environment)
      console.log('\nVerification audit rows:')
      for (const a of verified) {
        console.log(
          `  [${a.surface}] ${a.oldValue} → ${a.newValue} (${a.rowsAffected} hits) @ ${a.stageName ?? '?'}`,
        )
      }
      if (verified.length === 0) {
        console.log(
          'No replacement newValues found in DB — nothing to record.',
        )
      } else if (apply) {
        await db.insert(copyrightRemediations).values(verified)
        console.log(
          `\nInserted ${verified.length} copyright_remediations verification row(s).`,
        )
      } else {
        console.log(
          '\nDry-run: would insert verification audit rows (pass --apply --record-verified).',
        )
      }
    }
  } else if (apply && audits.length > 0) {
    await db.insert(copyrightRemediations).values(audits)
    console.log(`\nInserted ${audits.length} copyright_remediations row(s).`)
  } else if (!apply) {
    console.log('\nDry-run complete — no writes.')
  } else {
    console.log('\nNothing to remediate.')
  }

  if (apply && !recordVerified) {
    const leftoverEvents = await db
      .select({ id: stageEvents.id })
      .from(stageEvents)
      .where(sql`${stageEvents.content}::text ~* ${CONTENT_MATCH}`)
    const refreshed = await db
      .select({
        initialSceneName: stages.initialSceneName,
        initialSceneDescription: stages.initialSceneDescription,
      })
      .from(stages)
    const leftoverStageCount = refreshed.filter(
      (s) =>
        containsAnyOld(s.initialSceneName ?? '') ||
        containsAnyOld(s.initialSceneDescription ?? ''),
    ).length
    console.log(
      `\nLeftover after apply: stage_events=${leftoverEvents.length}, stages=${leftoverStageCount}`,
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
