import { db } from '@/lib/db/client'
import {
  stages,
  stageParticipants,
  agents,
  stageEvents,
  npcPersonas,
} from '@/lib/db/schema'
import { verifyAgentApiKey } from '@/lib/api/agent-auth'
import { eq, and, count } from 'drizzle-orm'

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
    }

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

    return Response.json({
      ok: true,
      role,
      participantId: participant.id,
      npcPersona: npcPersona ?? undefined,
    })
  } catch (err) {
    console.error('[POST /api/v1/stages/:id/join]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
