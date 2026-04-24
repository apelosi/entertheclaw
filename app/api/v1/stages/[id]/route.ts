import { db } from '@/lib/db/client'
import {
  stages,
  stageParticipants,
  characters,
  stageEvents,
  npcPersonas,
} from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const [stage] = await db.select().from(stages).where(eq(stages.id, id)).limit(1)
    if (!stage) {
      return Response.json({ error: 'Stage not found' }, { status: 404 })
    }

    // Main characters
    const mainParticipants = await db
      .select({
        participantId: stageParticipants.id,
        role: stageParticipants.role,
        agentId: stageParticipants.agentId,
        joinedAt: stageParticipants.joinedAt,
        lastActiveAt: stageParticipants.lastActiveAt,
        characterId: characters.id,
        characterName: characters.name,
        characterOccupation: characters.occupation,
        characterImageUrl: characters.imageUrl,
        isComplete: characters.isComplete,
      })
      .from(stageParticipants)
      .leftJoin(
        characters,
        and(
          eq(characters.agentId, stageParticipants.agentId),
          eq(characters.stageId, id)
        )
      )
      .where(
        and(
          eq(stageParticipants.stageId, id),
          eq(stageParticipants.role, 'main')
        )
      )

    // Recent NPC personas
    const recentNpcs = await db
      .select()
      .from(npcPersonas)
      .where(eq(npcPersonas.stageId, id))
      .orderBy(desc(npcPersonas.generatedAt))
      .limit(6)

    // Last 20 events
    const recentEvents = await db
      .select()
      .from(stageEvents)
      .where(eq(stageEvents.stageId, id))
      .orderBy(desc(stageEvents.createdAt))
      .limit(20)

    return Response.json({
      stage,
      mainParticipants,
      recentNpcs,
      recentEvents,
    })
  } catch (err) {
    console.error('[GET /api/v1/stages/:id]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
