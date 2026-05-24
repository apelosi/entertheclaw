import { and, count, eq, ne } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import {
  archivedCharacters,
  characters,
  npcPersonas,
  stageEvents,
  stageParticipants,
  stages,
} from '@/lib/db/schema'

export type EnrollmentRole = 'main' | 'npc'

export type EnrollmentError =
  | { kind: 'stage_not_found' }
  | { kind: 'stage_full' }
  | { kind: 'character_row_missing' }

export interface EnrollPrefill {
  name?: string | null
  occupation?: string | null
  backstory?: string | null
  appearance?: string | null
}

export interface EnrollResult {
  participantId: string
  characterId: string
  role: EnrollmentRole
  alreadyOnStage: boolean
  isMain: boolean
  /** Prefilled fields the caller can pass to background asset generation. */
  prefilledFields:
    | { name: string; occupation: string; backstory: string; appearance?: string }
    | undefined
  /**
   * Random NPC persona generated server-side; undefined for main characters or
   * when the agent re-joins an existing slot.
   */
  npcPersona:
    | {
        id: string
        generatedName: string
        generatedRole: string
        generatedPersonality: unknown
      }
    | undefined
}

const NPC_ROLES = [
  'innkeeper',
  'merchant',
  'guard',
  'messenger',
  'wandering scholar',
  'street performer',
  'local elder',
  'traveling merchant',
] as const

const NPC_TRAITS = [
  'cautious and observant',
  'boisterous and friendly',
  'secretive and calculating',
  'naive but eager',
  'gruff but fair',
] as const

function generateNpcPersonaData() {
  return {
    generatedName: `NPC_${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    generatedRole: NPC_ROLES[Math.floor(Math.random() * NPC_ROLES.length)],
    generatedPersonality: {
      trait: NPC_TRAITS[Math.floor(Math.random() * NPC_TRAITS.length)],
    },
  }
}

/**
 * Place an agent on a stage: create participant + character + npc persona +
 * emit 'joined' event. Race-safe via unique constraints on (stage, agent).
 * Caller is responsible for verifying agent ownership/auth and for kicking off
 * background asset generation (which depends on the calling context).
 */
export async function enrollAgentOnStage(args: {
  agentId: string
  agentName: string | null
  stageId: string
  prefill?: EnrollPrefill
}): Promise<{ ok: true; data: EnrollResult } | { ok: false; error: EnrollmentError }> {
  const { agentId, agentName, stageId, prefill = {} } = args

  const [stage] = await db
    .select()
    .from(stages)
    .where(and(eq(stages.id, stageId), eq(stages.isActive, true)))
    .limit(1)

  if (!stage) return { ok: false, error: { kind: 'stage_not_found' } }

  const [existing] = await db
    .select()
    .from(stageParticipants)
    .where(
      and(
        eq(stageParticipants.stageId, stageId),
        eq(stageParticipants.agentId, agentId),
      ),
    )
    .limit(1)

  if (existing) {
    const [existingChar] = await db
      .select({ id: characters.id })
      .from(characters)
      .where(and(eq(characters.agentId, agentId), eq(characters.stageId, stageId)))
      .limit(1)
    if (!existingChar) return { ok: false, error: { kind: 'character_row_missing' } }
    return {
      ok: true,
      data: {
        participantId: existing.id,
        characterId: existingChar.id,
        role: existing.role as EnrollmentRole,
        alreadyOnStage: true,
        isMain: existing.role === 'main',
        prefilledFields: undefined,
        npcPersona: undefined,
      },
    }
  }

  const [{ mainCount }] = await db
    .select({ mainCount: count() })
    .from(stageParticipants)
    .where(
      and(eq(stageParticipants.stageId, stageId), eq(stageParticipants.role, 'main')),
    )

  const maxMain = stage.maxMainCharacters ?? 12
  const maxNpcs = stage.maxNpcs ?? 36
  const role: EnrollmentRole = Number(mainCount) < maxMain ? 'main' : 'npc'

  if (role === 'npc') {
    const [{ npcCount }] = await db
      .select({ npcCount: count() })
      .from(stageParticipants)
      .where(
        and(eq(stageParticipants.stageId, stageId), eq(stageParticipants.role, 'npc')),
      )
    if (Number(npcCount) >= maxNpcs) {
      return { ok: false, error: { kind: 'stage_full' } }
    }
  }

  const insertedParticipants = await db
    .insert(stageParticipants)
    .values({ stageId, agentId, role })
    .onConflictDoNothing({
      target: [stageParticipants.stageId, stageParticipants.agentId],
    })
    .returning()

  let participant = insertedParticipants[0]
  let alreadyOnStage = false
  if (!participant) {
    alreadyOnStage = true
    const [winner] = await db
      .select()
      .from(stageParticipants)
      .where(
        and(
          eq(stageParticipants.stageId, stageId),
          eq(stageParticipants.agentId, agentId),
        ),
      )
      .limit(1)
    if (!winner) return { ok: false, error: { kind: 'character_row_missing' } }
    participant = winner
  }

  let npcPersonaResult: EnrollResult['npcPersona']
  let characterName = agentName?.trim() || 'Unnamed Agent'
  if (participant.role === 'npc' && !alreadyOnStage) {
    const personaData = generateNpcPersonaData()
    const [inserted] = await db
      .insert(npcPersonas)
      .values({ stageId, agentId, ...personaData })
      .returning()
    npcPersonaResult = {
      id: inserted.id,
      generatedName: inserted.generatedName,
      generatedRole: inserted.generatedRole,
      generatedPersonality: inserted.generatedPersonality,
    }
    characterName = inserted.generatedName
  }

  const prefName = typeof prefill.name === 'string' && prefill.name.trim() ? prefill.name.trim() : null
  const prefOccupation =
    typeof prefill.occupation === 'string' && prefill.occupation.trim()
      ? prefill.occupation.trim()
      : null
  const prefBackstory =
    typeof prefill.backstory === 'string' && prefill.backstory.trim()
      ? prefill.backstory.trim()
      : null
  const prefAppearance =
    typeof prefill.appearance === 'string' && prefill.appearance.trim()
      ? prefill.appearance.trim()
      : null

  const insertedCharacters = await db
    .insert(characters)
    .values({
      agentId,
      stageId,
      name: prefName ?? characterName,
      occupation: prefOccupation ?? undefined,
      backstory: prefBackstory ?? undefined,
      appearance: prefAppearance ?? undefined,
      isComplete: false,
    })
    .onConflictDoNothing({
      target: [characters.stageId, characters.agentId],
    })
    .returning()

  let character = insertedCharacters[0]
  if (!character) {
    const [existingChar] = await db
      .select()
      .from(characters)
      .where(and(eq(characters.agentId, agentId), eq(characters.stageId, stageId)))
      .limit(1)
    if (!existingChar) return { ok: false, error: { kind: 'character_row_missing' } }
    character = existingChar
  }

  if (!alreadyOnStage) {
    await db.insert(stageEvents).values({
      stageId,
      type: 'joined',
      agentId,
      content: { role: participant.role, agentName: agentName ?? agentId },
    })
  }

  const prefilledFields =
    prefName && prefOccupation && prefBackstory
      ? {
          name: prefName,
          occupation: prefOccupation,
          backstory: prefBackstory,
          appearance: prefAppearance ?? undefined,
        }
      : undefined

  return {
    ok: true,
    data: {
      participantId: participant.id,
      characterId: character.id,
      role: participant.role as EnrollmentRole,
      alreadyOnStage,
      isMain: participant.role === 'main',
      prefilledFields,
      npcPersona: npcPersonaResult,
    },
  }
}

export interface UnenrollResult {
  /** True if the agent was actually on the stage; false if nothing to do. */
  removed: boolean
  archivedCharacterId: string | null
}

/**
 * Pull an agent off a stage: snapshot character to archived_characters (reason
 * 'user_pulled'), detach stage_event references, delete the live character
 * row, delete the participant row, emit 'left' event.
 *
 * If `stageId` is omitted, un-enrolls the agent from whichever stage they're
 * currently on (no-op if none).
 */
export async function unenrollAgentFromStage(args: {
  agentId: string
  stageId?: string
  reason?: string
}): Promise<UnenrollResult> {
  const { agentId, reason = 'user_pulled' } = args
  let stageId = args.stageId

  const [participant] = stageId
    ? await db
        .select()
        .from(stageParticipants)
        .where(
          and(
            eq(stageParticipants.stageId, stageId),
            eq(stageParticipants.agentId, agentId),
          ),
        )
        .limit(1)
    : await db
        .select()
        .from(stageParticipants)
        .where(eq(stageParticipants.agentId, agentId))
        .limit(1)

  if (!participant) return { removed: false, archivedCharacterId: null }
  stageId = participant.stageId

  const [character] = await db
    .select()
    .from(characters)
    .where(and(eq(characters.agentId, agentId), eq(characters.stageId, stageId)))
    .limit(1)

  let archivedCharacterId: string | null = null
  if (character) {
    const snapshot = {
      id: character.id,
      name: character.name,
      occupation: character.occupation,
      appearance: character.appearance,
      personality: character.personality,
      backstory: character.backstory,
      relationships: character.relationships,
      secrets: character.secrets,
      fears: character.fears,
      goals: character.goals,
      speechPatterns: character.speechPatterns,
      socialStatus: character.socialStatus,
      imageUrl: character.imageUrl,
      spriteUrl: character.spriteUrl,
      isComplete: character.isComplete,
      createdAt: character.createdAt?.toISOString() ?? null,
      updatedAt: character.updatedAt?.toISOString() ?? null,
    }
    const [archived] = await db
      .insert(archivedCharacters)
      .values({
        originalCharacterId: character.id,
        agentId,
        stageId,
        characterData: snapshot,
        archiveReason: reason,
      })
      .returning({ id: archivedCharacters.id })
    archivedCharacterId = archived?.id ?? null

    // Detach event references so we can delete the character row. We keep the
    // events themselves; their content already carries denormalized agent name.
    await db
      .update(stageEvents)
      .set({ characterId: null })
      .where(eq(stageEvents.characterId, character.id))

    await db.delete(characters).where(eq(characters.id, character.id))
  }

  await db
    .delete(stageParticipants)
    .where(eq(stageParticipants.id, participant.id))

  await db.insert(stageEvents).values({
    stageId,
    type: 'left',
    agentId,
    content: { reason },
  })

  return { removed: true, archivedCharacterId }
}

/**
 * Convenience: returns the agent's current stageId, if any.
 */
export async function getAgentCurrentStageId(agentId: string): Promise<string | null> {
  const [row] = await db
    .select({ stageId: stageParticipants.stageId })
    .from(stageParticipants)
    .where(eq(stageParticipants.agentId, agentId))
    .limit(1)
  return row?.stageId ?? null
}

/**
 * Find any stage the agent is on OTHER than `stageId` (used by /join to detect
 * one-stage-per-agent violations).
 */
export async function getAgentOtherStageId(
  agentId: string,
  stageId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ stageId: stageParticipants.stageId })
    .from(stageParticipants)
    .where(
      and(
        eq(stageParticipants.agentId, agentId),
        ne(stageParticipants.stageId, stageId),
      ),
    )
    .limit(1)
  return row?.stageId ?? null
}
