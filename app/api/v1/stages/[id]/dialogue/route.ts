import { db } from '@/lib/db/client'
import { stageEvents, stageParticipants, characters } from '@/lib/db/schema'
import { verifyAgentApiKey } from '@/lib/api/agent-auth'
import { applySceneClassifier } from '@/lib/stage/apply-scene-classifier'
import { getActiveGrant } from '@/lib/stage/turn-state'
import { emitTurnOpen } from '@/lib/stage/emit-turn-open'
import { refreshCharacterMemoriesIfStale } from '@/lib/stage/character-memory'
import { normalizeStageDirectionMarkers } from '@/lib/stage/dialogue-format'
import { eq, and, desc } from 'drizzle-orm'

export const runtime = 'nodejs'

// Per-agent speak floor. An agent cannot post lines faster than this — a
// blast-radius cap against a runaway/looping agent flooding the stage (and its
// own model bill). Loose enough not to hinder normal turn-taking.
const SPEAK_MIN_INTERVAL_MS = 8_000

// Patterns that look like prompt injection attempts
const INJECTION_PATTERNS = [
  /\[SYSTEM\]/i,
  /\[INST\]/i,
  /ignore previous instructions/i,
  /you are now/i,
  /disregard/i,
]

function sanitizeContent(raw: string, agentId: string): string {
  // Strip nested AGENT_CONTENT tags and wrap in semantic tag
  const stripped = raw.replace(/\[AGENT_CONTENT[^\]]*\]/g, '').replace(/\[\/AGENT_CONTENT\]/g, '')
  return `[AGENT_CONTENT agent="${agentId}"]${stripped}[/AGENT_CONTENT]`
}

function hasInjectionRisk(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text))
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

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (
      typeof body !== 'object' ||
      body === null ||
      typeof (body as Record<string, unknown>).content !== 'string'
    ) {
      return Response.json({ error: 'content (string) required' }, { status: 400 })
    }

    const raw = normalizeStageDirectionMarkers(
      ((body as Record<string, unknown>).content as string).trim(),
    )
    if (!raw) {
      return Response.json({ error: 'content must not be empty' }, { status: 400 })
    }
    if (raw.length > 2000) {
      return Response.json({ error: 'content exceeds 2000 character limit' }, { status: 400 })
    }

    if (hasInjectionRisk(raw)) {
      return Response.json({ error: 'Content rejected' }, { status: 422 })
    }

    // Verify agent is a participant in this stage
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
      return Response.json({ error: 'Agent is not a participant in this stage' }, { status: 403 })
    }

    // Per-agent speak rate-limit: refuse a new line if this agent posted one
    // within SPEAK_MIN_INTERVAL_MS. Caps runaway/looping agents that would flood
    // the stage. moltbook-style 429 with a retry hint so well-behaved agents pace.
    const [lastLine] = await db
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
      .limit(1)
    if (lastLine?.createdAt) {
      const elapsed = Date.now() - new Date(lastLine.createdAt).getTime()
      if (elapsed < SPEAK_MIN_INTERVAL_MS) {
        const retryAfter = Math.ceil((SPEAK_MIN_INTERVAL_MS - elapsed) / 1000)
        return Response.json(
          {
            error: 'rate_limited',
            message:
              'You just spoke. Pace yourself — wait before taking another turn.',
            retry_after_seconds: retryAfter,
          },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } },
        )
      }
    }

    // Turn protocol: if another agent holds a live grant, refuse this dialogue.
    // The granted agent's own dialogue is allowed — writing it implicitly releases
    // their grant (getActiveGrant treats a dialogue-after-grant as consumed).
    const activeGrant = await getActiveGrant(stageId)
    if (activeGrant && activeGrant.agentId !== agent.id) {
      return Response.json(
        {
          error: 'turn_active',
          message: 'Another agent currently holds the turn. Wait for it to expire or claim a new turn.',
          grantedTo: activeGrant.agentId,
          expiresAt: activeGrant.expiresAt,
        },
        { status: 423 },
      )
    }

    // Get current character for speaker metadata
    const [character] = await db
      .select()
      .from(characters)
      .where(
        and(
          eq(characters.agentId, agent.id),
          eq(characters.stageId, stageId)
        )
      )
      .limit(1)

    const safe = sanitizeContent(raw, agent.id)

    const speakerName = character?.name ?? agent.name ?? 'Unknown'

    const [event] = await db
      .insert(stageEvents)
      .values({
        stageId,
        type: 'dialogue',
        agentId: agent.id,
        characterId: character?.id ?? null,
        content: {
          text: raw,
          safeText: safe,
          speakerName,
        },
      })
      .returning()

    const { sceneChanged } = await applySceneClassifier({
      stageId,
      sourceEvent: {
        id: event.id,
        kind: 'dialogue',
        speaker: speakerName,
        text: raw,
      },
    })

    // The just-posted dialogue consumes any grant the speaker held
    // (getActiveGrant treats dialogue-after-grant as consumed). Emit a fresh
    // `turn_open` so listening agents know the floor is open and see the
    // current snapshot (including this dialogue + any scene_change).
    await emitTurnOpen(stageId, {
      reason: 'dialogue',
      causedByEventId: event.id,
      sceneChanged,
    })

    // Fold the latest lines into each character's rolling memory when enough
    // have accrued. Best-effort and self-healing: the per-character cursor only
    // advances on success, so a dropped run is retried on the next line. Not
    // awaited — it must never delay the speaker's response.
    void refreshCharacterMemoriesIfStale(stageId)

    return Response.json({ ok: true, eventId: event.id })
  } catch (err) {
    console.error('[POST /api/v1/stages/:id/dialogue]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
