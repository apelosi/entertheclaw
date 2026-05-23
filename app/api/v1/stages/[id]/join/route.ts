import { db } from '@/lib/db/client'
import {
  stages,
  stageParticipants,
  agents,
  stageEvents,
  npcPersonas,
  characters,
} from '@/lib/db/schema'
import { verifyAgentApiKey } from '@/lib/api/agent-auth'
import { eq, and, count, ne } from 'drizzle-orm'
import { after } from 'next/server'
import { generateCharacterAssets } from '@/lib/characters/generate-character-assets'

export const runtime = 'nodejs'

async function generateNpcPersona(stageId: string, stageName: string) {
  // Call Gemini to generate a simple NPC persona
  // Gracefully degrades to a static fallback if API unavailable
  const roles = [
    'innkeeper',
    'merchant',
    'guard',
    'messenger',
    'wandering scholar',
    'street performer',
    'local elder',
    'traveling merchant',
  ]
  const personalities = [
    'cautious and observant',
    'boisterous and friendly',
    'secretive and calculating',
    'naive but eager',
    'gruff but fair',
  ]

  return {
    generatedName: `NPC_${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    generatedRole: roles[Math.floor(Math.random() * roles.length)],
    generatedPersonality: {
      trait: personalities[Math.floor(Math.random() * personalities.length)],
    },
  }
}

interface JoinBody {
  name?: string
  occupation?: string
  backstory?: string
  appearance?: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stageId } = await params

    const agent = await verifyAgentApiKey(request)
    if (!agent) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: JoinBody = {}
    try {
      body = (await request.json()) as JoinBody
    } catch {
      // empty body is fine
    }

    // Check stage exists and is active
    const [stage] = await db
      .select()
      .from(stages)
      .where(and(eq(stages.id, stageId), eq(stages.isActive, true)))
      .limit(1)

    if (!stage) {
      return Response.json({ error: 'Stage not found or inactive' }, { status: 404 })
    }

    // Check if agent is already in this stage
    const [existing] = await db
      .select()
      .from(stageParticipants)
      .where(
        and(
          eq(stageParticipants.stageId, stageId),
          eq(stageParticipants.agentId, agent.id)
        )
      )
      .limit(1)

    if (existing) {
      return Response.json({
        ok: true,
        role: existing.role,
        participantId: existing.id,
        message: 'Already in stage',
      })
    }

    // PRD: one stage per agent — reject if already on a different stage
    const [otherStage] = await db
      .select({ stageId: stageParticipants.stageId })
      .from(stageParticipants)
      .where(
        and(
          eq(stageParticipants.agentId, agent.id),
          ne(stageParticipants.stageId, stageId)
        )
      )
      .limit(1)

    if (otherStage) {
      return Response.json(
        { error: 'Agent is already active on another stage' },
        { status: 409 }
      )
    }

    // Count current main characters
    const [{ mainCount }] = await db
      .select({ mainCount: count() })
      .from(stageParticipants)
      .where(
        and(
          eq(stageParticipants.stageId, stageId),
          eq(stageParticipants.role, 'main')
        )
      )

    const maxMain = stage.maxMainCharacters ?? 12
    const maxNpcs = stage.maxNpcs ?? 36
    const role = Number(mainCount) < maxMain ? 'main' : 'npc'

    // Check NPC capacity if being assigned as NPC
    if (role === 'npc') {
      const [{ npcCount }] = await db
        .select({ npcCount: count() })
        .from(stageParticipants)
        .where(
          and(
            eq(stageParticipants.stageId, stageId),
            eq(stageParticipants.role, 'npc')
          )
        )

      if (Number(npcCount) >= maxNpcs) {
        return Response.json({ error: 'Stage is at capacity' }, { status: 409 })
      }
    }

    // Insert participant
    const [participant] = await db
      .insert(stageParticipants)
      .values({
        stageId,
        agentId: agent.id,
        role: role as 'main' | 'npc',
      })
      .returning()

    // Generate NPC persona if needed
    let npcPersona = null
    let characterName = agent.name ?? 'Unnamed Agent'
    if (role === 'npc') {
      const persona = await generateNpcPersona(stageId, stage.name)
      const [inserted] = await db
        .insert(npcPersonas)
        .values({
          stageId,
          agentId: agent.id,
          ...persona,
        })
        .returning()
      npcPersona = inserted
      characterName = inserted.generatedName
    }

    // Agent-provided character fields take priority over LLM generation.
    const agentName = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null
    const agentOccupation = typeof body.occupation === 'string' && body.occupation.trim() ? body.occupation.trim() : null
    const agentBackstory = typeof body.backstory === 'string' && body.backstory.trim() ? body.backstory.trim() : null
    const agentAppearance = typeof body.appearance === 'string' && body.appearance.trim() ? body.appearance.trim() : null

    // Stub character row so dialogue/heartbeat resolve speaker metadata
    const [character] = await db
      .insert(characters)
      .values({
        agentId: agent.id,
        stageId,
        name: agentName ?? characterName,
        occupation: agentOccupation ?? undefined,
        backstory: agentBackstory ?? undefined,
        appearance: agentAppearance ?? undefined,
        isComplete: false,
      })
      .returning()

    // Emit joined event
    await db.insert(stageEvents).values({
      stageId,
      type: 'joined',
      agentId: agent.id,
      content: {
        role,
        agentName: agent.name ?? agent.id,
      },
    })

    // Kick off portrait + sprite generation in the background.
    // If the agent provided name/occupation/backstory, the LLM bible step is skipped.
    // Runs after the response is flushed (Next 15 `after()` API). Failures
    // are logged and never block the join response.
    const generationCharacterId = character.id
    const generationIsMain = role === 'main'
    const prefilledFields =
      agentName && agentOccupation && agentBackstory
        ? { name: agentName, occupation: agentOccupation, backstory: agentBackstory, appearance: agentAppearance ?? undefined }
        : undefined
    after(async () => {
      try {
        await generateCharacterAssets({
          characterId: generationCharacterId,
          isMain: generationIsMain,
          prefilledFields,
        })
      } catch (err) {
        console.error('[join] background asset generation failed', err)
      }
    })

    return Response.json({
      ok: true,
      role,
      participantId: participant.id,
      characterId: character.id,
      npcPersona: npcPersona ?? undefined,
    })
  } catch (err) {
    console.error('[POST /api/v1/stages/:id/join]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
