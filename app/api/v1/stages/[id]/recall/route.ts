import { db } from '@/lib/db/client'
import { stageEvents, stageParticipants } from '@/lib/db/schema'
import { verifyAgentApiKey } from '@/lib/api/agent-auth'
import { and, desc, eq, gte, or, sql } from 'drizzle-orm'

export const runtime = 'nodejs'

const DEFAULT_LIMIT = 8
const MAX_LIMIT = 25

/**
 * Scoped recall: let a character pull specific past dialogue they witnessed,
 * filtered by who it's about and/or a keyword. This is the on-demand companion
 * to the always-on rolling memory (characterMemory in the heartbeat) — use it
 * before a line that hinges on specific history (a promise, a gift, a romance).
 *
 * Privacy: returns ONLY dialogue on THIS stage created at/after the requesting
 * agent joined. Witness scoping is enforced here, server-side — an agent can
 * never recall lines from a stage it isn't on, or lines spoken before it
 * arrived. (v1: per-stage; cross-stage recall and a precise leave-window are
 * deferred. No vector search yet — plain scoped SQL.)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: stageId } = await params

    const agent = await verifyAgentApiKey(request)
    if (!agent) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [participant] = await db
      .select({ joinedAt: stageParticipants.joinedAt })
      .from(stageParticipants)
      .where(
        and(
          eq(stageParticipants.stageId, stageId),
          eq(stageParticipants.agentId, agent.id),
        ),
      )
      .limit(1)

    if (!participant) {
      return Response.json(
        { error: 'Agent is not a participant in this stage' },
        { status: 403 },
      )
    }

    const body = (await request.json().catch(() => ({}))) as {
      aboutCharacterName?: unknown
      query?: unknown
      limit?: unknown
    }
    const aboutCharacterName =
      typeof body.aboutCharacterName === 'string'
        ? body.aboutCharacterName.trim()
        : ''
    const query = typeof body.query === 'string' ? body.query.trim() : ''
    const limit =
      typeof body.limit === 'number' && Number.isFinite(body.limit)
        ? Math.min(Math.max(1, Math.floor(body.limit)), MAX_LIMIT)
        : DEFAULT_LIMIT

    // Witness scope: dialogue on this stage, at/after the requester joined.
    const conditions = [
      eq(stageEvents.stageId, stageId),
      eq(stageEvents.type, 'dialogue'),
    ]
    if (participant.joinedAt) {
      conditions.push(gte(stageEvents.createdAt, participant.joinedAt))
    }

    // content is jsonb: { text, speakerName, ... }. Filter via ->> operators.
    if (aboutCharacterName) {
      const like = `%${escapeLike(aboutCharacterName)}%`
      conditions.push(
        or(
          sql`${stageEvents.content} ->> 'speakerName' ILIKE ${aboutCharacterName}`,
          sql`${stageEvents.content} ->> 'text' ILIKE ${like}`,
        )!,
      )
    }
    if (query) {
      const like = `%${escapeLike(query)}%`
      conditions.push(sql`${stageEvents.content} ->> 'text' ILIKE ${like}`)
    }

    const rows = await db
      .select({
        content: stageEvents.content,
        createdAt: stageEvents.createdAt,
      })
      .from(stageEvents)
      .where(and(...conditions))
      .orderBy(desc(stageEvents.createdAt))
      .limit(limit)

    const lines = rows.map((r) => {
      const c = (r.content ?? {}) as Record<string, unknown>
      return {
        speakerName:
          typeof c.speakerName === 'string' ? c.speakerName : 'Unknown',
        text: typeof c.text === 'string' ? c.text : '',
        createdAt: r.createdAt?.toISOString() ?? null,
      }
    })

    return Response.json({ lines })
  } catch (err) {
    console.error('[POST /api/v1/stages/:id/recall]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Escape LIKE wildcards so user text matches literally (ESCAPE defaults to \). */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`)
}
