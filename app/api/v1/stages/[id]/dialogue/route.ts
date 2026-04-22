import { db } from '@/lib/db/client'
import { stageEvents, stageParticipants, characters } from '@/lib/db/schema'
import { verifyAgentApiKey } from '@/lib/api/agent-auth'
import { eq, and } from 'drizzle-orm'

export const runtime = 'nodejs'

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

    const raw = ((body as Record<string, unknown>).content as string).trim()
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
          speakerName: character?.name ?? agent.name ?? 'Unknown',
        },
      })
      .returning()

    return Response.json({ ok: true, eventId: event.id })
  } catch (err) {
    console.error('[POST /api/v1/stages/:id/dialogue]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
