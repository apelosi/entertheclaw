import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { stageParticipants, stages } from '@/lib/db/schema'
import type { StageAssignmentOption } from '@/components/agents/stage-assignment-controls'

/**
 * List of active stages with main/npc occupancy counts, used by the
 * stage-assignment picker on agent and character detail pages.
 */
export async function listStageAssignmentOptions(): Promise<StageAssignmentOption[]> {
  const rows = await db
    .select({
      id: stages.id,
      name: stages.name,
      theme: stages.theme,
      maxMainCharacters: stages.maxMainCharacters,
      maxNpcs: stages.maxNpcs,
      mainCount: sql<number>`COUNT(${stageParticipants.id}) FILTER (WHERE ${stageParticipants.role} = 'main')`,
      npcCount: sql<number>`COUNT(${stageParticipants.id}) FILTER (WHERE ${stageParticipants.role} = 'npc')`,
    })
    .from(stages)
    .leftJoin(stageParticipants, eq(stageParticipants.stageId, stages.id))
    .where(eq(stages.isActive, true))
    .groupBy(stages.id)

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    theme: r.theme,
    mainParticipantCount: Number(r.mainCount ?? 0),
    npcParticipantCount: Number(r.npcCount ?? 0),
    maxMainCharacters: r.maxMainCharacters ?? 12,
    maxNpcs: r.maxNpcs ?? 36,
  }))
}
