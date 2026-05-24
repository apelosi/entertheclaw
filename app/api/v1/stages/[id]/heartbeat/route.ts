import { db } from '@/lib/db/client'
import {
  agents,
  stageParticipants,
  stages,
  characters,
  stageEvents,
} from '@/lib/db/schema'
import { verifyAgentApiKey } from '@/lib/api/agent-auth'
import {
  classifyStageActivity,
  getActiveGrant,
  getLastDialogueAt,
  PULSE_HINT_ACTIVE_MS,
  PULSE_HINT_IDLE_MS,
} from '@/lib/stage/turn-state'
import { eq, and, desc, gte } from 'drizzle-orm'
import { resolveCurrentScene } from '@/lib/stage/apply-scene-classifier'

export const runtime = 'nodejs'

const ADDRESSED_LOOKBACK = 5 // last N dialogue events to scan for character name
const UNREAD_CAP = 50

function isAddressed(text: unknown, characterName: string | null): boolean {
  if (!characterName || typeof text !== 'string') return false
  const escaped = characterName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  const re = new RegExp(`\\b${escaped}\\b`, 'i')
  return re.test(text)
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

    const [participant] = await db
      .select()
      .from(stageParticipants)
      .where(
        and(
          eq(stageParticipants.stageId, stageId),
          eq(stageParticipants.agentId, agent.id)
        )
      )
      .limit(1)

    if (!participant) {
      return Response.json(
        { error: 'Agent is not a participant in this stage' },
        { status: 403 }
      )
    }

    const now = new Date()
    // Snapshot the previous lastActiveAt BEFORE we update it, so unreadEvents
    // can use it as a cursor.
    const previousLastActiveAt = participant.lastActiveAt ?? null

    await Promise.all([
      db
        .update(agents)
        .set({ lastHeartbeatAt: now })
        .where(eq(agents.id, agent.id)),
      db
        .update(stageParticipants)
        .set({ lastActiveAt: now })
        .where(eq(stageParticipants.id, participant.id)),
    ])

    const [stage] = await db
      .select()
      .from(stages)
      .where(eq(stages.id, stageId))
      .limit(1)

    const [currentCharacter] = await db
      .select()
      .from(characters)
      .where(and(eq(characters.agentId, agent.id), eq(characters.stageId, stageId)))
      .limit(1)

    const recentEvents = await db
      .select()
      .from(stageEvents)
      .where(eq(stageEvents.stageId, stageId))
      .orderBy(desc(stageEvents.createdAt))
      .limit(10)

    let unreadEvents: typeof recentEvents = []
    if (previousLastActiveAt) {
      unreadEvents = await db
        .select()
        .from(stageEvents)
        .where(
          and(
            eq(stageEvents.stageId, stageId),
            gte(stageEvents.createdAt, previousLastActiveAt),
          ),
        )
        .orderBy(desc(stageEvents.createdAt))
        .limit(UNREAD_CAP)
    } else {
      // First heartbeat for this participant — give them the recent context only
      unreadEvents = recentEvents
    }

    const stageActivity = await classifyStageActivity(stageId)
    const activeGrant = await getActiveGrant(stageId)
    const lastDialogueAt = await getLastDialogueAt(stageId)

    const lastDialogueAgoMs =
      lastDialogueAt === null ? null : Math.max(0, Date.now() - lastDialogueAt)
    // Floor is open whenever no live grant is held. No quiet timer — the
    // claim collection window inside POST /turn/claim handles concurrency.
    const turnIsOpen = !activeGrant

    // addressedToYou: scan last few dialogue events
    const charName = currentCharacter?.name ?? null
    const recentDialogues = recentEvents
      .filter((e) => e.type === 'dialogue')
      .slice(0, ADDRESSED_LOOKBACK)
    const addressedToYou = recentDialogues.some((e) => {
      const c = e.content as { text?: string; speakerName?: string } | null
      if (!c) return false
      // Skip lines you spoke yourself
      if (e.agentId === agent.id) return false
      return isAddressed(c.text, charName)
    })

    const pulseHintMs = stageActivity === 'active' ? PULSE_HINT_ACTIVE_MS : PULSE_HINT_IDLE_MS
    // If you were just addressed, suggest pulsing sooner regardless of overall stage activity.
    const nextPulseSuggestionMs = addressedToYou
      ? Math.min(pulseHintMs, 60_000)
      : pulseHintMs

    const resolvedScene = await resolveCurrentScene(stageId)
    const currentScene = resolvedScene?.scene ?? null

    const latestTurnOpen = unreadEvents.find((e) => e.type === 'turn_open')
    const turnOpenContent =
      latestTurnOpen &&
      typeof latestTurnOpen.content === 'object' &&
      latestTurnOpen.content !== null
        ? (latestTurnOpen.content as Record<string, unknown>)
        : null
    const sceneChanged = turnOpenContent?.sceneChanged === true

    return Response.json({
      ok: true,
      timestamp: now.toISOString(),
      stage: stage
        ? {
            id: stage.id,
            name: stage.name,
            theme: stage.theme,
            isActive: stage.isActive,
          }
        : null,
      character: currentCharacter ?? null,
      recentEvents,
      // ── Phase 1 protocol fields ─────────────────────────────────────────
      stageActivity,
      pulseHintMs,
      nextPulseSuggestionMs,
      turnState: {
        open: turnIsOpen,
        lastDialogueAgoMs,
        grantedTo: activeGrant?.agentId ?? null,
        grantExpiresAt: activeGrant?.expiresAt ?? null,
      },
      addressedToYou,
      unreadEvents,
      currentScene,
      sceneChanged,
    })
  } catch (err) {
    console.error('[POST /api/v1/stages/:id/heartbeat]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
