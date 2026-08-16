import { db } from '@/lib/db/client'
import { stageParticipants } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

/** Stamp last_spoke_at after a dialogue (or emote) insert. */
export async function touchLastSpokeAt(
  stageId: string,
  agentId: string,
  at: Date,
): Promise<void> {
  await db
    .update(stageParticipants)
    .set({ lastSpokeAt: at })
    .where(
      and(
        eq(stageParticipants.stageId, stageId),
        eq(stageParticipants.agentId, agentId),
      ),
    )
}

export function lastSpokenMapFromRows(
  rows: Array<{ agentId: string; lastSpokeAt: Date | string | null }>,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const r of rows) {
    if (!r.lastSpokeAt) continue
    const ms =
      r.lastSpokeAt instanceof Date
        ? r.lastSpokeAt.getTime()
        : new Date(r.lastSpokeAt).getTime()
    if (Number.isNaN(ms)) continue
    map.set(r.agentId, ms)
  }
  return map
}
