/**
 * End-to-end character asset generation for a single (agent, stage) pair:
 *   1. Generate the character fields via LLM (or use agent-provided prefill).
 *   2. Generate one image (pixel-art sprite) and store it in imageUrl/portraitBytes.
 *   3. Emit a `character_ready` stage_event so the live stage view refreshes.
 *
 * One image is generated and used everywhere (stage canvas + character cards).
 * Designed to run AFTER the join response is sent (Next 15 `after()`).
 */
import { db } from '@/lib/db/client'
import { agents, characters, stages, stageEvents } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { generateCharacterBible } from './generate-bible'
import { generateSprite } from './generate-character-images'

export interface PrefilledCharacterFields {
  name: string
  occupation: string
  backstory: string
  appearance?: string
}

export interface GenerateAssetsArgs {
  characterId: string
  /** True for main-character role; false for NPC. NPCs still get a bible — shorter. */
  isMain: boolean
  /**
   * When the agent provided name/role/description at join time, pass them here.
   * The LLM bible step is skipped and images are generated from these fields directly.
   */
  prefilledFields?: PrefilledCharacterFields
}

function publicAssetUrl(characterId: string, version: number): string {
  return `/api/images/character/${characterId}/portrait?v=${version}`
}

export async function generateCharacterAssets(args: GenerateAssetsArgs): Promise<void> {
  const { characterId, isMain, prefilledFields } = args

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

  // ─── 1. Character fields ────────────────────────────────────────────────
  // If the agent supplied name/role/description at join time, use them directly
  // and skip the full LLM bible. Otherwise fall back to LLM generation.
  let resolvedName: string
  let resolvedOccupation: string
  let resolvedAppearance: string

  if (prefilledFields) {
    resolvedName = prefilledFields.name
    resolvedOccupation = prefilledFields.occupation

    if (prefilledFields.appearance) {
      resolvedAppearance = prefilledFields.appearance
    } else {
      // Derive a brief appearance from the agent-provided context via LLM.
      try {
        const { generateAppearance } = await import('./generate-bible')
        resolvedAppearance = await generateAppearance({
          name: prefilledFields.name,
          occupation: prefilledFields.occupation,
          backstory: prefilledFields.backstory,
          stageName: stage.name,
          stageTheme: stage.theme,
        })
      } catch {
        resolvedAppearance = `${prefilledFields.occupation} of mysterious appearance`
      }
    }

    // Persist agent-provided fields so dialogue resolves the right speaker name immediately.
    await db
      .update(characters)
      .set({
        name: resolvedName,
        occupation: resolvedOccupation,
        backstory: prefilledFields.backstory,
        appearance: resolvedAppearance,
        updatedAt: new Date(),
      })
      .where(eq(characters.id, characterId))
  } else {
    // ─── Full LLM bible ──────────────────────────────────────────────────
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

    resolvedName = bible.name
    resolvedOccupation = bible.occupation
    resolvedAppearance = bible.appearance

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
  }

  // ─── 2. Image (single sprite, used everywhere) ─────────────────────────
  const nextVersion = (character.assetsVersion ?? 0) + 1
  const updates: Partial<typeof characters.$inferInsert> = {
    assetsVersion: nextVersion,
    isComplete: true,
    updatedAt: new Date(),
  }

  try {
    const imageBytes = await generateSprite({
      characterName: resolvedName,
      appearance: resolvedAppearance,
      occupation: resolvedOccupation,
      stageName: stage.name,
      stageTheme: stage.theme,
    })
    updates.portraitBytes = imageBytes
    updates.imageUrl = publicAssetUrl(characterId, nextVersion)
  } catch (err) {
    console.warn('[character-assets] image generation failed', characterId, err)
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
      characterName: resolvedName,
      imageUrl: updates.imageUrl ?? null,
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
