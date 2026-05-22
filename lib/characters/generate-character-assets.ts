/**
 * End-to-end character asset generation for a single (agent, stage) pair:
 *   1. Generate the 11-field character bible via LLM.
 *   2. Generate portrait + sprite images in parallel.
 *   3. Persist everything to the `characters` row.
 *   4. Emit a `character_ready` stage_event so the live stage view refreshes.
 *
 * Designed to run AFTER the join response is sent (Next 15 `after()`).
 * Each step is best-effort: a failed image still leaves the bible populated
 * and we mark `assetsVersion` accordingly so the client can decide what to show.
 */
import { db } from '@/lib/db/client'
import { agents, characters, stages, stageEvents } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { generateCharacterBible } from './generate-bible'
import { generatePortrait, generateSprite } from './generate-character-images'

export interface GenerateAssetsArgs {
  characterId: string
  /** True for main-character role; false for NPC. NPCs still get a bible — shorter. */
  isMain: boolean
}

const PORTRAIT_KIND = 'portrait'
const SPRITE_KIND = 'sprite'

function publicAssetUrl(characterId: string, kind: 'portrait' | 'sprite', version: number): string {
  return `/api/images/character/${characterId}/${kind}?v=${version}`
}

export async function generateCharacterAssets(args: GenerateAssetsArgs): Promise<void> {
  const { characterId, isMain } = args

  const [row] = await db
    .select({
      character: characters,
      stage: stages,
      agent: agents,
    })
    .from(characters)
    .innerJoin(stages, eq(stages.id, characters.stageId))
    .innerJoin(agents, eq(agents.id, characters.agentId))
    .where(eq(characters.id, characterId))
    .limit(1)

  if (!row) {
    console.warn('[character-assets] character not found', { characterId })
    return
  }

  const { character, stage, agent } = row
  if (character.isComplete) {
    // Already fully generated. Skip.
    return
  }

  // ─── 1. Bible ──────────────────────────────────────────────────────────
  let bible
  try {
    bible = await generateCharacterBible({
      stageName: stage.name,
      stageTheme: stage.theme,
      stageDescription: stage.description ?? null,
      agentName: agent.name ?? 'Unnamed Agent',
      isMain,
    })
  } catch (err) {
    console.error('[character-assets] bible generation failed', characterId, err)
    return
  }

  // Persist bible immediately so dialogue gets the right speakerName ASAP.
  await db
    .update(characters)
    .set({
      name: bible.name,
      occupation: bible.occupation,
      appearance: bible.appearance,
      personality: bible.personality,
      backstory: bible.backstory,
      relationships: bible.relationships,
      secrets: bible.secrets,
      fears: bible.fears,
      goals: bible.goals,
      speechPatterns: bible.speechPatterns,
      socialStatus: bible.socialStatus,
      updatedAt: new Date(),
    })
    .where(eq(characters.id, characterId))

  // ─── 2. Images (parallel) ──────────────────────────────────────────────
  const imageInput = {
    characterName: bible.name,
    appearance: bible.appearance,
    occupation: bible.occupation,
    stageName: stage.name,
    stageTheme: stage.theme,
  }

  const [portraitResult, spriteResult] = await Promise.allSettled([
    generatePortrait(imageInput),
    generateSprite(imageInput),
  ])

  const nextVersion = (character.assetsVersion ?? 0) + 1
  const updates: Partial<typeof characters.$inferInsert> = {
    assetsVersion: nextVersion,
    isComplete: true,
    updatedAt: new Date(),
  }

  if (portraitResult.status === 'fulfilled') {
    updates.portraitBytes = portraitResult.value
    updates.imageUrl = publicAssetUrl(characterId, PORTRAIT_KIND, nextVersion)
  } else {
    console.warn('[character-assets] portrait generation failed', characterId, portraitResult.reason)
  }

  if (spriteResult.status === 'fulfilled') {
    updates.spriteBytes = spriteResult.value
    updates.spriteUrl = publicAssetUrl(characterId, SPRITE_KIND, nextVersion)
  } else {
    console.warn('[character-assets] sprite generation failed', characterId, spriteResult.reason)
  }

  await db.update(characters).set(updates).where(eq(characters.id, characterId))

  // ─── 3. Notify live stage viewers ──────────────────────────────────────
  await db.insert(stageEvents).values({
    stageId: character.stageId,
    type: 'character_ready',
    agentId: character.agentId,
    characterId,
    content: {
      characterId,
      agentId: character.agentId,
      characterName: bible.name,
      imageUrl: updates.imageUrl ?? null,
      spriteUrl: updates.spriteUrl ?? null,
    },
  })
}

/**
 * Idempotent re-runner — used by the on-demand generate endpoint. Bypasses
 * the `isComplete` short-circuit.
 */
export async function regenerateCharacterAssets(characterId: string): Promise<void> {
  await db
    .update(characters)
    .set({ isComplete: false })
    .where(and(eq(characters.id, characterId)))
  await generateCharacterAssets({ characterId, isMain: true })
}
