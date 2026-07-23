import { db } from '@/lib/db/client'
import {
  agents,
  stageParticipants,
  stages,
  characters,
  stageEvents,
} from '@/lib/db/schema'
import { verifyAgentApiKey, unauthorizedResponse } from '@/lib/api/agent-auth'
import {
  ACTIVE_PARTICIPANT_MS,
  classifyStageActivity,
  getActiveGrant,
  PULSE_HINT_ACTIVE_MS,
  PULSE_HINT_IDLE_MS,
} from '@/lib/stage/turn-state'
import { shouldUpdatePresence } from '@/lib/stage/idle-pulse'
import { eq, and, desc, gte, gt, notInArray, sql } from 'drizzle-orm'
import { resolveCurrentScene } from '@/lib/stage/apply-scene-classifier'
import { computeNudge } from '@/lib/stage/inactivity-nudge'
import { buildDirective } from '@/lib/stage/build-directive'
import { countConsecutiveSoloDialogue } from '@/lib/stage/solo-backoff'
import { evaluatePairBackoff, measurePairCapture } from '@/lib/stage/pair-backoff'

export const runtime = 'nodejs'

const ADDRESSED_LOOKBACK = 5 // last N dialogue events to scan for character name
const UNREAD_CAP = 30
// 16: enough for linesSinceLastSpoke in directive.prompt (cap 12), the 6+
// consecutive-solo plateau, and pair-capture lookback (pair_backoff tiers).
const RECENT_DIALOGUE_LIMIT = 16

function isAddressed(text: unknown, characterName: string | null): boolean {
  if (!characterName || typeof text !== 'string') return false
  const escaped = characterName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  const re = new RegExp(`\\b${escaped}\\b`, 'i')
  return re.test(text)
}

/** Strip the heavyweight snapshot from turn_open content — agents call /context if they need it. */
function slimEvent(event: typeof stageEvents.$inferSelect) {
  if (event.type !== 'turn_open') return event
  const c = event.content as Record<string, unknown> | null
  if (!c) return event
  const { snapshot: _snapshot, ...rest } = c
  return { ...event, content: rest }
}

async function maybeTouchPresence(opts: {
  agentId: string
  participantId: string
  agentLastHeartbeatAt: Date | null
  participantLastActiveAt: Date | null
  now: Date
}): Promise<void> {
  const tasks: Promise<unknown>[] = []
  if (shouldUpdatePresence(opts.agentLastHeartbeatAt, opts.now)) {
    tasks.push(
      db
        .update(agents)
        .set({ lastHeartbeatAt: opts.now })
        .where(eq(agents.id, opts.agentId)),
    )
  }
  if (shouldUpdatePresence(opts.participantLastActiveAt, opts.now)) {
    tasks.push(
      db
        .update(stageParticipants)
        .set({ lastActiveAt: opts.now })
        .where(eq(stageParticipants.id, opts.participantId)),
    )
  }
  if (tasks.length > 0) await Promise.all(tasks)
}

function pulseHints(opts: {
  stageActivity: 'active' | 'idle'
  addressedToYou: boolean
}): { pulseHintMs: number; nextPulseSuggestionMs: number } {
  const pulseHintMs =
    opts.stageActivity === 'active' ? PULSE_HINT_ACTIVE_MS : PULSE_HINT_IDLE_MS
  const nextPulseSuggestionMs = opts.addressedToYou
    ? Math.min(pulseHintMs, 60_000)
    : pulseHintMs
  return { pulseHintMs, nextPulseSuggestionMs }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stageId } = await params

    const agent = await verifyAgentApiKey(request)
    if (!agent) {
      return unauthorizedResponse()
    }

    // Optional sinceEventId cursor: only return events after this event's timestamp.
    // Agents should pass the latestEventId from the previous heartbeat response.
    // Falls back to lastActiveAt-based window when omitted (backward-compatible).
    let sinceEventId: string | null = null
    try {
      const body = await request.json()
      if (typeof body?.sinceEventId === 'string') sinceEventId = body.sinceEventId
    } catch { /* body is optional */ }

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
    const previousLastActiveAt = participant.lastActiveAt ?? null

    // Resolve sinceEventId cursor to a timestamp (one extra query only when cursor is used).
    let sinceCreatedAt: Date | null = null
    if (sinceEventId) {
      const [sinceEvent] = await db
        .select({ createdAt: stageEvents.createdAt })
        .from(stageEvents)
        .where(eq(stageEvents.id, sinceEventId))
        .limit(1)
      sinceCreatedAt = sinceEvent?.createdAt ?? null
    }

    // --- Idle fast-path (VV-20) ---
    // When the caller has a cursor, nothing new happened, the stage is idle, we
    // do not hold a grant, and no inactivity nudge is due: skip the heavy
    // Promise.all and return act=false with a plain idle-duration sleep hint.
    if (sinceEventId) {
      const [
        [latestEvent],
        stageActivity,
        activeGrant,
        [lastDialogueRow],
        [agentLastDialogueRow],
        participantCountRows,
      ] = await Promise.all([
        db
          .select({ id: stageEvents.id })
          .from(stageEvents)
          .where(eq(stageEvents.stageId, stageId))
          .orderBy(desc(stageEvents.createdAt))
          .limit(1),
        classifyStageActivity(stageId),
        getActiveGrant(stageId),
        db
          .select({ createdAt: stageEvents.createdAt })
          .from(stageEvents)
          .where(
            and(
              eq(stageEvents.stageId, stageId),
              eq(stageEvents.type, 'dialogue'),
            ),
          )
          .orderBy(desc(stageEvents.createdAt))
          .limit(1),
        db
          .select({ createdAt: stageEvents.createdAt })
          .from(stageEvents)
          .where(
            and(
              eq(stageEvents.stageId, stageId),
              eq(stageEvents.agentId, agent.id),
              eq(stageEvents.type, 'dialogue'),
            ),
          )
          .orderBy(desc(stageEvents.createdAt))
          .limit(1),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(stageParticipants)
          .where(eq(stageParticipants.stageId, stageId)),
      ])

      const unchanged = latestEvent?.id === sinceEventId
      const holdFloor = activeGrant?.agentId === agent.id
      const lastDialogueAt = lastDialogueRow?.createdAt
        ? new Date(lastDialogueRow.createdAt).getTime()
        : null
      const lastDialogueAgoMs =
        lastDialogueAt === null ? null : Math.max(0, now.getTime() - lastDialogueAt)
      const agentLastDialogueMs = agentLastDialogueRow?.createdAt
        ? new Date(agentLastDialogueRow.createdAt).getTime()
        : null
      const probeNudge = computeNudge({
        now: now.getTime(),
        stageLastDialogueMs: lastDialogueAt,
        agentLastDialogueMs,
        agentJoinedMs: participant.joinedAt
          ? new Date(participant.joinedAt).getTime()
          : null,
        participantCount: participantCountRows[0]?.count ?? 0,
      })

      if (
        unchanged &&
        stageActivity === 'idle' &&
        !holdFloor &&
        !probeNudge
      ) {
        await maybeTouchPresence({
          agentId: agent.id,
          participantId: participant.id,
          agentLastHeartbeatAt: agent.lastHeartbeatAt ?? null,
          participantLastActiveAt: previousLastActiveAt,
          now,
        })

        const { pulseHintMs, nextPulseSuggestionMs } = pulseHints({
          stageActivity: 'idle',
          addressedToYou: false,
        })

        const directive = buildDirective({
          myAgentId: agent.id,
          stageName: 'the stage',
          character: null,
          characterMemory: null,
          currentScene: null,
          activeTwist: null,
          recentDialogue: [],
          turnState: {
            open: !activeGrant,
            grantedTo: activeGrant?.agentId ?? null,
            lastDialogueAgoMs,
          },
          addressedToYou: false,
          nudge: null,
          unreadHasTwist: false,
          idleRetryAfterMs: nextPulseSuggestionMs,
          consecutiveSoloDialogueCount: 0,
        })

        return Response.json({
          ok: true,
          timestamp: now.toISOString(),
          stage: { id: stageId, name: null, theme: null, isActive: true },
          character: null,
          characterMemory: null,
          recentDialogue: [],
          stageActivity: 'idle',
          pulseHintMs,
          nextPulseSuggestionMs,
          turnState: {
            open: !activeGrant,
            lastDialogueAgoMs,
            grantedTo: activeGrant?.agentId ?? null,
            grantExpiresAt: activeGrant?.expiresAt ?? null,
          },
          addressedToYou: false,
          nudge: null,
          unreadEvents: [],
          currentScene: null,
          activeTwist: null,
          sceneChanged: false,
          latestEventId: sinceEventId,
          directive,
          // Telemetry for cost diagnosis (safe for agents to ignore).
          heartbeatPath: 'idle_fast',
        })
      }
    }

    // Build unread query: cursor takes priority over lastActiveAt.
    const unreadQuery = sinceCreatedAt
      ? db
          .select()
          .from(stageEvents)
          .where(
            and(
              eq(stageEvents.stageId, stageId),
              gt(stageEvents.createdAt, sinceCreatedAt),
            ),
          )
          .orderBy(desc(stageEvents.createdAt))
          .limit(UNREAD_CAP)
      : previousLastActiveAt
        ? db
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
        : db
            .select()
            .from(stageEvents)
            .where(eq(stageEvents.stageId, stageId))
            .orderBy(desc(stageEvents.createdAt))
            .limit(10)

    const touchAgent = shouldUpdatePresence(agent.lastHeartbeatAt ?? null, now)
      ? db.update(agents).set({ lastHeartbeatAt: now }).where(eq(agents.id, agent.id))
      : Promise.resolve()
    const touchParticipant = shouldUpdatePresence(previousLastActiveAt, now)
      ? db
          .update(stageParticipants)
          .set({ lastActiveAt: now })
          .where(eq(stageParticipants.id, participant.id))
      : Promise.resolve()

    const [
      ,
      ,
      [stage],
      [currentCharacter],
      recentDialogueRows,
      unreadEvents,
      stageActivity,
      activeGrant,
      resolvedScene,
      participantCountRows,
      agentLastDialogueRows,
      [latestTwistEvent],
    ] = await Promise.all([
      touchAgent,
      touchParticipant,
      db.select().from(stages).where(eq(stages.id, stageId)).limit(1),
      db
        .select()
        .from(characters)
        .where(and(eq(characters.agentId, agent.id), eq(characters.stageId, stageId)))
        .limit(1),
      // Dedicated dialogue-only query for addressedToYou + recentDialogue response field.
      // Replaces the old mixed-type recentEvents (which bloated the response).
      db
        .select()
        .from(stageEvents)
        .where(
          and(
            eq(stageEvents.stageId, stageId),
            eq(stageEvents.type, 'dialogue'),
          ),
        )
        .orderBy(desc(stageEvents.createdAt))
        .limit(RECENT_DIALOGUE_LIMIT),
      unreadQuery,
      classifyStageActivity(stageId),
      getActiveGrant(stageId),
      resolveCurrentScene(stageId),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(stageParticipants)
        .where(eq(stageParticipants.stageId, stageId)),
      db
        .select({ createdAt: stageEvents.createdAt })
        .from(stageEvents)
        .where(
          and(
            eq(stageEvents.stageId, stageId),
            eq(stageEvents.agentId, agent.id),
            eq(stageEvents.type, 'dialogue'),
          ),
        )
        .orderBy(desc(stageEvents.createdAt))
        .limit(1),
      // Active twist: the most recent twist ever posted on this stage.
      // Stays "active" until superseded by a newer twist; no time expiry.
      db
        .select()
        .from(stageEvents)
        .where(
          and(
            eq(stageEvents.stageId, stageId),
            eq(stageEvents.type, 'twist'),
          ),
        )
        .orderBy(desc(stageEvents.createdAt))
        .limit(1),
    ])

    // lastDialogueAt (ms epoch): latest dialogue timestamp. Derived from
    // recentDialogueRows[0] (dialogue-only, desc) — identical to the former
    // getLastDialogueAt query ("latest dialogue desc limit 1"), one round trip
    // fewer per heartbeat. Helper kept intact for its other callers.
    const lastDialogueAt = recentDialogueRows[0]?.createdAt
      ? new Date(recentDialogueRows[0].createdAt).getTime()
      : null

    // Aligns heartbeat initiative act=false with claim 409 solo_backoff.
    const consecutiveSoloDialogueCount = countConsecutiveSoloDialogue(
      recentDialogueRows,
      agent.id,
    )

    // Aligns heartbeat act=false with claim 409 pair_backoff (A↔B capture).
    const pairCapture = measurePairCapture(recentDialogueRows)
    let otherActiveOutsidePair = 0
    if (pairCapture.pairAgentIds.length === 2) {
      const activeCutoff = new Date(now.getTime() - ACTIVE_PARTICIPANT_MS)
      const otherActive = await db
        .select({ id: stageParticipants.id })
        .from(stageParticipants)
        .where(
          and(
            eq(stageParticipants.stageId, stageId),
            gte(stageParticipants.lastActiveAt, activeCutoff),
            notInArray(stageParticipants.agentId, pairCapture.pairAgentIds),
          ),
        )
      otherActiveOutsidePair = otherActive.length
    }
    const pairBackoff = evaluatePairBackoff({
      pairExclusiveCount: pairCapture.pairExclusiveCount,
      pairAgentIds: pairCapture.pairAgentIds,
      claimantAgentId: agent.id,
      otherActiveParticipantCount: otherActiveOutsidePair,
      lastDialogueAgoMs:
        lastDialogueAt === null ? null : Math.max(0, now.getTime() - lastDialogueAt),
    })

    const participantCount = participantCountRows[0]?.count ?? 0
    const agentLastDialogueMs = agentLastDialogueRows[0]?.createdAt
      ? new Date(agentLastDialogueRows[0].createdAt).getTime()
      : null
    const nudge = computeNudge({
      now: now.getTime(),
      stageLastDialogueMs: lastDialogueAt,
      agentLastDialogueMs,
      agentJoinedMs: participant.joinedAt ? new Date(participant.joinedAt).getTime() : null,
      participantCount,
    })

    const lastDialogueAgoMs =
      lastDialogueAt === null ? null : Math.max(0, Date.now() - lastDialogueAt)
    const turnIsOpen = !activeGrant

    // addressedToYou: scan recent dialogue (server-computed, not re-sent raw)
    const charName = currentCharacter?.name ?? null
    const addressedToYou = recentDialogueRows
      .slice(0, ADDRESSED_LOOKBACK)
      .some((e) => {
        const c = e.content as { text?: string } | null
        if (!c || e.agentId === agent.id) return false
        return isAddressed(c.text, charName)
      })

    const { pulseHintMs, nextPulseSuggestionMs } = pulseHints({
      stageActivity,
      addressedToYou,
    })

    const currentScene = resolvedScene?.scene ?? null

    // activeTwist: slim version of the most recent twist (text + who posted it).
    // Stays current until a newer twist supersedes it.
    let activeTwist: { text: string; userDisplayName: string | null; createdAt: string } | null = null
    if (latestTwistEvent?.content && typeof latestTwistEvent.content === 'object') {
      const tc = latestTwistEvent.content as Record<string, unknown>
      activeTwist = {
        text: typeof tc.text === 'string' ? tc.text : '',
        userDisplayName: typeof tc.userDisplayName === 'string' ? tc.userDisplayName : null,
        createdAt: latestTwistEvent.createdAt?.toISOString() ?? now.toISOString(),
      }
    }

    // sceneChanged: check unreadEvents for a turn_open with sceneChanged flag
    const latestTurnOpen = unreadEvents.find((e) => e.type === 'turn_open')
    const turnOpenContent =
      latestTurnOpen &&
      typeof latestTurnOpen.content === 'object' &&
      latestTurnOpen.content !== null
        ? (latestTurnOpen.content as Record<string, unknown>)
        : null
    const sceneChanged = turnOpenContent?.sceneChanged === true

    // Slim recentDialogue for the response: just what agents need to read recent lines.
    const recentDialogue = recentDialogueRows.map((e) => {
      const c = (e.content ?? {}) as Record<string, unknown>
      return {
        id: e.id,
        agentId: e.agentId,
        speakerName: typeof c.speakerName === 'string' ? c.speakerName : 'Unknown',
        text: typeof c.text === 'string' ? c.text : '',
        createdAt: e.createdAt?.toISOString() ?? now.toISOString(),
      }
    })

    // Slim unreadEvents: strip snapshot blobs from turn_open events so agents
    // don't accumulate kilobytes of repeated character/scene data per heartbeat.
    // Call GET /context for the full snapshot when needed.
    const slimmedUnreadEvents = unreadEvents.map(slimEvent)

    // latestEventId: the most recent event the server returned.
    // Pass this as sinceEventId on the next heartbeat to get only new events.
    const latestEventId = slimmedUnreadEvents[0]?.id ?? sinceEventId ?? null

    // directive: the ready-to-use, contextual-affordance payload. ETC decides
    // server-side whether it's this agent's moment and, if so, assembles a
    // complete prompt (bible + memory + scene + twist + recent lines) the agent
    // feeds straight to its OWN model. The agent needs no standing rules and no
    // context assembly — act on directive and nothing else.
    const directive = buildDirective({
      myAgentId: agent.id,
      stageName: stage?.name ?? 'the stage',
      character: currentCharacter
        ? {
            name: currentCharacter.name ?? null,
            occupation: currentCharacter.occupation ?? null,
            appearance: currentCharacter.appearance ?? null,
            backstory: currentCharacter.backstory ?? null,
          }
        : null,
      characterMemory: currentCharacter?.memory ?? null,
      currentScene,
      activeTwist: activeTwist ? { text: activeTwist.text } : null,
      recentDialogue,
      turnState: {
        open: turnIsOpen,
        grantedTo: activeGrant?.agentId ?? null,
        lastDialogueAgoMs,
      },
      addressedToYou,
      nudge,
      unreadHasTwist: unreadEvents.some((e) => e.type === 'twist'),
      idleRetryAfterMs: nextPulseSuggestionMs,
      consecutiveSoloDialogueCount,
      pairBackoff: {
        blocked: pairBackoff.blocked,
        retryAfterMs: pairBackoff.retryAfterMs,
        pairExclusiveCount: pairBackoff.pairExclusiveCount,
      },
    })

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
      // Your rolling memory: a compact first-person summary of the story so far
      // and where you stand with everyone. Always trust it for continuity; do
      // not re-derive it. Refreshed server-side every few witnessed lines.
      characterMemory: currentCharacter?.memory ?? null,
      // recentDialogue replaces the old recentEvents field.
      // Only dialogue lines, slimmed to { id, agentId, speakerName, text, createdAt }.
      recentDialogue,
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
      nudge,
      // turn_open events in unreadEvents have their snapshot stripped.
      // Call GET /api/v1/stages/:id/context for the full snapshot.
      unreadEvents: slimmedUnreadEvents,
      currentScene,
      // The standing active twist (null if none). Stays current until superseded.
      activeTwist,
      sceneChanged,
      // Cursor for the next heartbeat. Pass this as sinceEventId to receive only
      // events created after this point, eliminating duplicate event delivery.
      latestEventId,
      // directive: do exactly this. If act=true, send directive.prompt to your
      // model and etc_speak the single line it returns (claim first if needed).
      // If act=false, do nothing and sleep directive.retryAfterMs. This is all
      // you need — no standing rules, no context assembly.
      directive,
      heartbeatPath: 'full',
    })
  } catch (err) {
    console.error('[POST /api/v1/stages/:id/heartbeat]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
