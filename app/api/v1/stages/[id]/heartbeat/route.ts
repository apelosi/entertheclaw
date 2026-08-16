import { verifyAgentApiKey, unauthorizedResponse } from '@/lib/api/agent-auth'
import {
  PULSE_HINT_ACTIVE_MS,
  PULSE_HINT_IDLE_MS,
} from '@/lib/stage/turn-state'
import { computeNudge } from '@/lib/stage/inactivity-nudge'
import { buildDirective } from '@/lib/stage/build-directive'
import { countConsecutiveSoloDialogue } from '@/lib/stage/solo-backoff'
import { evaluatePairBackoff, measurePairCapture } from '@/lib/stage/pair-backoff'
import {
  loadHeartbeatContext,
  maybeTouchPresence,
  type HeartbeatEventRow,
} from '@/lib/stage/load-heartbeat-context'

export const runtime = 'nodejs'

const ADDRESSED_LOOKBACK = 5 // last N dialogue events to scan for character name

function isAddressed(text: unknown, characterName: string | null): boolean {
  if (!characterName || typeof text !== 'string') return false
  const escaped = characterName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  const re = new RegExp(`\\b${escaped}\\b`, 'i')
  return re.test(text)
}

/** Strip the heavyweight snapshot from turn_open content — agents call /context if they need it. */
function slimEvent(event: HeartbeatEventRow) {
  if (event.type !== 'turn_open') return event
  const c = event.content as Record<string, unknown> | null
  if (!c) return event
  const { snapshot: _snapshot, ...rest } = c
  return { ...event, content: rest }
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
    let sinceEventId: string | null = null
    try {
      const body = await request.json()
      if (typeof body?.sinceEventId === 'string') sinceEventId = body.sinceEventId
    } catch { /* body is optional */ }

    const now = new Date()
    const ctx = await loadHeartbeatContext({
      stageId,
      agentId: agent.id,
      sinceEventId,
      now,
    })

    if (!ctx.participant) {
      return Response.json(
        { error: 'Agent is not a participant in this stage' },
        { status: 403 }
      )
    }

    await maybeTouchPresence({
      agentId: agent.id,
      participantId: ctx.participant.id,
      agentLastHeartbeatAt: agent.lastHeartbeatAt ?? null,
      participantLastActiveAt: ctx.participant.lastActiveAt,
      now,
    })

    const {
      stage,
      character: currentCharacter,
      recentDialogueRows,
      unreadEvents,
      stageActivity,
      activeGrant,
      currentScene,
      participantCount,
      agentLastDialogueMs,
      lastDialogueAt,
      latestTwistEvent,
      activeAgentIds,
    } = ctx

    // Aligns heartbeat initiative act=false with claim 409 solo_backoff.
    const consecutiveSoloDialogueCount = countConsecutiveSoloDialogue(
      recentDialogueRows,
      agent.id,
    )

    // Aligns heartbeat act=false with claim 409 pair_backoff (A↔B capture).
    const pairCapture = measurePairCapture(recentDialogueRows)
    let otherActiveOutsidePair = 0
    if (pairCapture.pairAgentIds.length === 2) {
      otherActiveOutsidePair = activeAgentIds.filter(
        (id) => !pairCapture.pairAgentIds.includes(id),
      ).length
    }
    const pairBackoff = evaluatePairBackoff({
      pairExclusiveCount: pairCapture.pairExclusiveCount,
      pairAgentIds: pairCapture.pairAgentIds,
      claimantAgentId: agent.id,
      otherActiveParticipantCount: otherActiveOutsidePair,
      lastDialogueAgoMs:
        lastDialogueAt === null ? null : Math.max(0, now.getTime() - lastDialogueAt),
    })

    const nudge = computeNudge({
      now: now.getTime(),
      stageLastDialogueMs: lastDialogueAt,
      agentLastDialogueMs,
      agentJoinedMs: ctx.participant.joinedAt
        ? ctx.participant.joinedAt.getTime()
        : null,
      participantCount,
    })

    const lastDialogueAgoMs =
      lastDialogueAt === null ? null : Math.max(0, Date.now() - lastDialogueAt)
    const turnIsOpen = !activeGrant

    const charName = currentCharacter?.name ?? null
    const addressedToYou = recentDialogueRows
      .slice(0, ADDRESSED_LOOKBACK)
      .some((e) => {
        const c = e.content as { text?: string } | null
        if (!c || e.agentId === agent.id) return false
        return isAddressed(c.text, charName)
      })

    const pulseHintMs = stageActivity === 'active' ? PULSE_HINT_ACTIVE_MS : PULSE_HINT_IDLE_MS
    const nextPulseSuggestionMs = addressedToYou
      ? Math.min(pulseHintMs, 60_000)
      : pulseHintMs

    let activeTwist: { text: string; userDisplayName: string | null; createdAt: string } | null = null
    if (latestTwistEvent?.content && typeof latestTwistEvent.content === 'object') {
      const tc = latestTwistEvent.content as Record<string, unknown>
      activeTwist = {
        text: typeof tc.text === 'string' ? tc.text : '',
        userDisplayName: typeof tc.userDisplayName === 'string' ? tc.userDisplayName : null,
        createdAt: latestTwistEvent.createdAt?.toISOString() ?? now.toISOString(),
      }
    }

    const latestTurnOpen = unreadEvents.find((e) => e.type === 'turn_open')
    const turnOpenContent =
      latestTurnOpen &&
      typeof latestTurnOpen.content === 'object' &&
      latestTurnOpen.content !== null
        ? (latestTurnOpen.content as Record<string, unknown>)
        : null
    const sceneChanged = turnOpenContent?.sceneChanged === true

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

    const slimmedUnreadEvents = unreadEvents.map(slimEvent)
    const latestEventId = slimmedUnreadEvents[0]?.id ?? sinceEventId ?? null

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
      characterMemory: currentCharacter?.memory ?? null,
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
      unreadEvents: slimmedUnreadEvents,
      currentScene,
      activeTwist,
      sceneChanged,
      latestEventId,
      directive,
    })
  } catch (err) {
    console.error('[POST /api/v1/stages/:id/heartbeat]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
