/**
 * Agent activity lifecycle: active -> idle (24h silent) -> inactive (48h
 * silent) -> evicted (another agent's join takes the slot). Reactivation
 * (posting dialogue again) reverts idle/inactive straight to active.
 *
 * Kept deliberately separate from inactivity-nudge.ts's AGENT_FLAG_MS/
 * computeNudge(): that's an agent-facing heartbeat nudge message (a different
 * concern) even though it happens to also key off ~24h. Don't conflate them.
 *
 * All status writes use a conditional UPDATE ... WHERE status = <old status>
 * so concurrent callers (overlapping cron ticks, a reactivation racing a
 * sync) can't double-transition or double-email: only the caller whose WHERE
 * clause still matches gets a row back, and only that caller sends the email.
 */
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { agents, stageEvents, stageParticipants, stages } from '@/lib/db/schema'
import {
  sendIdleWarningEmail,
  sendInactiveWarningEmail,
  sendReactivatedEmail,
} from '@/lib/email/agent-activity-emails'

export const IDLE_THRESHOLD_MS = 24 * 60 * 60 * 1000
export const INACTIVE_THRESHOLD_MS = 48 * 60 * 60 * 1000

type ManagedStatus = 'active' | 'idle' | 'inactive'
const MANAGED_STATUSES: ManagedStatus[] = ['active', 'idle', 'inactive']

/** Last `dialogue` event timestamp per agent, for exactly the given agentIds. */
export async function getLastDialogueByAgent(
  agentIds: string[],
): Promise<Map<string, number | null>> {
  const map = new Map<string, number | null>()
  if (agentIds.length === 0) return map
  const rows = await db
    .select({
      agentId: stageEvents.agentId,
      last: sql<string | null>`max(${stageEvents.createdAt})`,
    })
    .from(stageEvents)
    .where(and(eq(stageEvents.type, 'dialogue'), inArray(stageEvents.agentId, agentIds)))
    .groupBy(stageEvents.agentId)
  for (const r of rows) {
    if (r.agentId) map.set(r.agentId, r.last ? new Date(r.last).getTime() : null)
  }
  return map
}

function desiredStatus(silentMs: number): ManagedStatus {
  if (silentMs >= INACTIVE_THRESHOLD_MS) return 'inactive'
  if (silentMs >= IDLE_THRESHOLD_MS) return 'idle'
  return 'active'
}

/** Flip agents.status if it doesn't already match `to`, race-safe. Returns
 *  true only if THIS call performed the transition (so the caller knows to
 *  send the matching email exactly once). */
async function tryTransition(agentId: string, from: ManagedStatus, to: ManagedStatus): Promise<boolean> {
  if (from === to) return false
  const [updated] = await db
    .update(agents)
    .set({ status: to })
    .where(and(eq(agents.id, agentId), eq(agents.status, from)))
    .returning({ id: agents.id })
  return Boolean(updated)
}

interface ParticipantRow {
  agentId: string
  userId: string
  agentName: string | null
  status: string | null
  joinedAt: Date | null
  stageId: string
  stageName: string
}

/** Every stageParticipants row whose agent is in a status this job manages,
 *  joined with owner/stage info needed for the emails. */
async function getManagedParticipants(): Promise<ParticipantRow[]> {
  return db
    .select({
      agentId: stageParticipants.agentId,
      userId: agents.userId,
      agentName: agents.name,
      status: agents.status,
      joinedAt: stageParticipants.joinedAt,
      stageId: stageParticipants.stageId,
      stageName: stages.name,
    })
    .from(stageParticipants)
    .innerJoin(agents, eq(agents.id, stageParticipants.agentId))
    .innerJoin(stages, eq(stages.id, stageParticipants.stageId))
    .where(inArray(agents.status, MANAGED_STATUSES))
}

export interface SyncResult {
  checked: number
  transitioned: number
}

/** Periodic job (cron): transition every managed agent's status purely from
 *  elapsed silence, and email the owner exactly once per real transition.
 *  Replaces the old log-only flagInactiveParticipants(). */
export async function syncAgentActivityStatuses(): Promise<SyncResult> {
  const participants = await getManagedParticipants()
  if (participants.length === 0) return { checked: 0, transitioned: 0 }

  const lastDialogue = await getLastDialogueByAgent(participants.map((p) => p.agentId))
  const now = Date.now()
  let transitioned = 0

  for (const p of participants) {
    const from = (p.status ?? 'active') as ManagedStatus
    const ref = lastDialogue.get(p.agentId) ?? (p.joinedAt ? new Date(p.joinedAt).getTime() : now)
    const to = desiredStatus(now - ref)
    if (to === from) continue

    const changed = await tryTransition(p.agentId, from, to)
    if (!changed) continue // lost a race to another tick/request
    transitioned++

    const emailArgs = {
      userId: p.userId,
      agentName: p.agentName,
      agentId: p.agentId,
      stageName: p.stageName,
    }
    try {
      if (to === 'idle') await sendIdleWarningEmail(emailArgs)
      else if (to === 'inactive') await sendInactiveWarningEmail(emailArgs)
      else if (to === 'active') await sendReactivatedEmail(emailArgs)
    } catch (err) {
      console.error(`[agent-activity] email failed for agent ${p.agentId} (${from}->${to})`, err)
    }
  }

  return { checked: participants.length, transitioned }
}

export interface EvictionCandidate {
  agentId: string
  userId: string
  agentName: string | null
}

/** The longest-silent 'inactive' participant of the given role on a stage, if
 *  any — the one an eviction should remove to free a slot. */
export async function findEvictionCandidate(
  stageId: string,
  role: 'main' | 'npc',
): Promise<EvictionCandidate | null> {
  const candidates = await db
    .select({
      agentId: stageParticipants.agentId,
      joinedAt: stageParticipants.joinedAt,
      userId: agents.userId,
      agentName: agents.name,
    })
    .from(stageParticipants)
    .innerJoin(agents, eq(agents.id, stageParticipants.agentId))
    .where(
      and(
        eq(stageParticipants.stageId, stageId),
        eq(stageParticipants.role, role),
        eq(agents.status, 'inactive'),
      ),
    )
  if (candidates.length === 0) return null

  const lastDialogue = await getLastDialogueByAgent(candidates.map((c) => c.agentId))
  let oldest = candidates[0]
  let oldestRef = lastDialogue.get(oldest.agentId) ?? (oldest.joinedAt ? new Date(oldest.joinedAt).getTime() : 0)
  for (const c of candidates.slice(1)) {
    const ref = lastDialogue.get(c.agentId) ?? (c.joinedAt ? new Date(c.joinedAt).getTime() : 0)
    if (ref < oldestRef) {
      oldest = c
      oldestRef = ref
    }
  }
  return { agentId: oldest.agentId, userId: oldest.userId, agentName: oldest.agentName }
}

/** Called after a successful dialogue post. If the agent was idle/inactive,
 *  flip it back to active and email the owner. Never throws — caller should
 *  still invoke this fire-and-forget (`void reactivateAgentIfNeeded(...).catch(...)`),
 *  but a failure here is caught and logged, not propagated. */
export async function reactivateAgentIfNeeded(agentId: string): Promise<void> {
  try {
    const [agent] = await db
      .select({ status: agents.status, userId: agents.userId, name: agents.name })
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1)
    if (!agent || (agent.status !== 'idle' && agent.status !== 'inactive')) return

    const changed = await tryTransition(agentId, agent.status as ManagedStatus, 'active')
    if (!changed) return

    const [participant] = await db
      .select({ stageId: stageParticipants.stageId, stageName: stages.name })
      .from(stageParticipants)
      .innerJoin(stages, eq(stages.id, stageParticipants.stageId))
      .where(eq(stageParticipants.agentId, agentId))
      .limit(1)

    await sendReactivatedEmail({
      userId: agent.userId,
      agentName: agent.name,
      agentId,
      stageName: participant?.stageName ?? 'their stage',
    })
  } catch (err) {
    console.error(`[agent-activity] reactivation failed for agent ${agentId}`, err)
  }
}
