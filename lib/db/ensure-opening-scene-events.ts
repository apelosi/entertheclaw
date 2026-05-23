/**
 * Ensure each stage has exactly one opening scene_change (origin story) from
 * stages.initial_scene_name / initial_scene_description.
 */
import { and, asc, count, eq, inArray, sql } from 'drizzle-orm'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema'

const { stageEvents, stages } = schema

/** In-world date for every stage's opening scene (matches db:seed-scenes). */
export const OPENING_SCENE_AT = new Date('2016-05-22T12:00:00.000Z')

/** SQL: opening / origin scene_change row (no agent, seeded reason). */
export const openingSceneEventFilter = sql`(
  ${stageEvents.type} = 'scene_change'
  AND ${stageEvents.agentId} IS NULL
  AND ${stageEvents.content}->>'reason' = 'Opening scene'
)`

export interface OriginStoryAudit {
  stageCount: number
  withColumns: number
  withOpening: number
  missingColumns: string[]
  missingOpening: string[]
  duplicateOpening: string[]
}

export async function auditOriginStories(
  db: NeonHttpDatabase<typeof schema>,
): Promise<OriginStoryAudit> {
  const allStages = await db
    .select({
      id: stages.id,
      name: stages.name,
      initialSceneName: stages.initialSceneName,
      initialSceneDescription: stages.initialSceneDescription,
    })
    .from(stages)

  const missingColumns: string[] = []
  const missingOpening: string[] = []
  const duplicateOpening: string[] = []
  let withColumns = 0
  let withOpening = 0

  for (const stage of allStages) {
    const hasColumns = Boolean(stage.initialSceneName && stage.initialSceneDescription)
    if (hasColumns) withColumns++
    else missingColumns.push(stage.name)

    const [row] = await db
      .select({ n: count() })
      .from(stageEvents)
      .where(and(eq(stageEvents.stageId, stage.id), openingSceneEventFilter))

    const n = Number(row?.n ?? 0)
    if (n === 1) withOpening++
    else if (n === 0) missingOpening.push(stage.name)
    else duplicateOpening.push(stage.name)
  }

  return {
    stageCount: allStages.length,
    withColumns,
    withOpening,
    missingColumns,
    missingOpening,
    duplicateOpening,
  }
}

/** Promote earliest scene_change to canonical opening when reason tag is missing. */
async function migrateLegacyOpeningScenes(
  db: NeonHttpDatabase<typeof schema>,
): Promise<number> {
  const allStages = await db
    .select({
      id: stages.id,
      name: stages.name,
      initialSceneName: stages.initialSceneName,
      initialSceneDescription: stages.initialSceneDescription,
    })
    .from(stages)

  let migrated = 0

  for (const stage of allStages) {
    if (!stage.initialSceneName || !stage.initialSceneDescription) continue

    const [hasOpening] = await db
      .select({ n: count() })
      .from(stageEvents)
      .where(and(eq(stageEvents.stageId, stage.id), openingSceneEventFilter))
    if (Number(hasOpening?.n ?? 0) > 0) continue

    const [legacy] = await db
      .select({ id: stageEvents.id })
      .from(stageEvents)
      .where(
        and(
          eq(stageEvents.stageId, stage.id),
          eq(stageEvents.type, 'scene_change'),
          sql`${stageEvents.agentId} IS NULL`,
        ),
      )
      .orderBy(asc(stageEvents.createdAt))
      .limit(1)

    if (!legacy) continue

    await db
      .update(stageEvents)
      .set({
        createdAt: OPENING_SCENE_AT,
        content: {
          name: stage.initialSceneName,
          description: stage.initialSceneDescription,
          reason: 'Opening scene',
        },
      })
      .where(eq(stageEvents.id, legacy.id))

    migrated++
  }

  return migrated
}

/** Keep one opening scene_change per stage; delete extras matching the opening filter. */
async function dedupeOpeningSceneEvents(
  db: NeonHttpDatabase<typeof schema>,
): Promise<number> {
  const allStages = await db.select({ id: stages.id }).from(stages)
  const toDelete: string[] = []

  for (const stage of allStages) {
    const openings = await db
      .select({ id: stageEvents.id, createdAt: stageEvents.createdAt })
      .from(stageEvents)
      .where(and(eq(stageEvents.stageId, stage.id), openingSceneEventFilter))
      .orderBy(asc(stageEvents.createdAt))

    if (openings.length <= 1) continue
    for (const row of openings.slice(1)) {
      toDelete.push(row.id)
    }
  }

  if (toDelete.length === 0) return 0

  await db.delete(stageEvents).where(inArray(stageEvents.id, toDelete))
  return toDelete.length
}

export async function ensureOpeningSceneEvents(
  db: NeonHttpDatabase<typeof schema>,
): Promise<{ inserted: number; alreadyHad: number; noColumns: number }> {
  const allStages = await db
    .select({
      id: stages.id,
      name: stages.name,
      initialSceneName: stages.initialSceneName,
      initialSceneDescription: stages.initialSceneDescription,
    })
    .from(stages)

  let inserted = 0
  let alreadyHad = 0
  let noColumns = 0

  for (const stage of allStages) {
    const [row] = await db
      .select({ n: count() })
      .from(stageEvents)
      .where(and(eq(stageEvents.stageId, stage.id), openingSceneEventFilter))

    if (Number(row?.n ?? 0) > 0) {
      alreadyHad++
      continue
    }

    if (!stage.initialSceneName || !stage.initialSceneDescription) {
      noColumns++
      continue
    }

    await db.insert(stageEvents).values({
      stageId: stage.id,
      type: 'scene_change',
      createdAt: OPENING_SCENE_AT,
      content: {
        name: stage.initialSceneName,
        description: stage.initialSceneDescription,
        reason: 'Opening scene',
      },
    })
    inserted++
  }

  return { inserted, alreadyHad, noColumns }
}

/**
 * Run before production wipe: migrate legacy openings, dedupe, insert missing.
 * Returns audit; caller should abort wipe if any stage still lacks an opening.
 */
export async function prepareOriginStories(
  db: NeonHttpDatabase<typeof schema>,
): Promise<{
  migrated: number
  deduped: number
  openings: { inserted: number; alreadyHad: number; noColumns: number }
  audit: OriginStoryAudit
}> {
  const migrated = await migrateLegacyOpeningScenes(db)
  const openings = await ensureOpeningSceneEvents(db)
  const deduped = await dedupeOpeningSceneEvents(db)
  const audit = await auditOriginStories(db)
  return { migrated, deduped, openings, audit }
}

/** Delete runtime stage_events but keep opening scene_change rows. */
export async function deleteRuntimeStageEvents(
  db: NeonHttpDatabase<typeof schema>,
): Promise<number> {
  const deleted = await db
    .delete(stageEvents)
    .where(sql`NOT ${openingSceneEventFilter}`)
    .returning({ id: stageEvents.id })
  return deleted.length
}

export function printOriginAudit(audit: OriginStoryAudit): void {
  console.log(`\nOrigin stories: ${audit.withOpening}/${audit.stageCount} stages have exactly one opening.`)
  console.log(`  stages with initial_scene columns: ${audit.withColumns}/${audit.stageCount}`)
  if (audit.missingColumns.length > 0) {
    console.log(`  missing columns: ${audit.missingColumns.join(', ')}`)
  }
  if (audit.missingOpening.length > 0) {
    console.log(`  missing opening event: ${audit.missingOpening.join(', ')}`)
  }
  if (audit.duplicateOpening.length > 0) {
    console.log(`  duplicate openings: ${audit.duplicateOpening.join(', ')}`)
  }
}

export function originStoriesReady(audit: OriginStoryAudit): boolean {
  return (
    audit.missingColumns.length === 0 &&
    audit.missingOpening.length === 0 &&
    audit.duplicateOpening.length === 0 &&
    audit.withOpening === audit.stageCount
  )
}
