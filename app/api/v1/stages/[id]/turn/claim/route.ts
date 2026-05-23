import { db } from '@/lib/db/client'
import { stageEvents, stageParticipants, characters } from '@/lib/db/schema'
import { verifyAgentApiKey } from '@/lib/api/agent-auth'
import {
  COLLECTION_WINDOW_MS,
  GRANT_TTL_MS,
  getActiveGrant,
  getLastSpokenMap,
  pickClaimWinner,
  type ClaimContent,
  type GrantContent,
} from '@/lib/stage/turn-state'
import { and, desc, eq, gt, gte } from 'drizzle-orm'
import crypto from 'crypto'

export const runtime = 'nodejs'

interface ClaimBody {
  stake?: number
  intent?: string
}

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
      .select()
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

    let body: ClaimBody = {}
    try {
      body = (await request.json()) as ClaimBody
    } catch {
      // empty body is allowed
    }

    const stake = Math.max(1, Math.min(10, Math.floor(body.stake ?? 5)))
    const intent =
      typeof body.intent === 'string' && body.intent.trim()
        ? body.intent.trim().slice(0, 200)
        : undefined

    // Resolve character once for grant content
    const [character] = await db
      .select({ id: characters.id })
      .from(characters)
      .where(and(eq(characters.agentId, agent.id), eq(characters.stageId, stageId)))
      .limit(1)

    // Step 1: is there an active grant already?
    const active = await getActiveGrant(stageId)
    if (active) {
      if (active.agentId === agent.id) {
        // Idempotent re-grant
        return Response.json({
          ok: true,
          granted: true,
          claimId: active.claimId,
          expiresAt: active.expiresAt,
          message: 'You already hold the active grant.',
        })
      }
      return Response.json(
        {
          ok: false,
          error: 'turn_active',
          grantedTo: active.agentId,
          expiresAt: active.expiresAt,
        },
        { status: 409 },
      )
    }

    // Step 2: insert my claim
    const claimId = crypto.randomUUID()
    const claimContent: ClaimContent = { claimId, stake, intent }
    const [claimEvent] = await db
      .insert(stageEvents)
      .values({
        stageId,
        type: 'turn_claim',
        agentId: agent.id,
        characterId: character?.id ?? null,
        content: claimContent,
      })
      .returning()

    const myClaimAt = claimEvent.createdAt?.getTime() ?? Date.now()

    // Step 3: wait for the collection window so concurrent claims can land
    await new Promise((r) => setTimeout(r, COLLECTION_WINDOW_MS + 100))

    // Step 4: re-read all turn_claim events around my claim time
    const windowStart = new Date(myClaimAt - COLLECTION_WINDOW_MS)
    const windowEnd = new Date(myClaimAt + COLLECTION_WINDOW_MS)
    const competingClaims = await db
      .select()
      .from(stageEvents)
      .where(
        and(
          eq(stageEvents.stageId, stageId),
          eq(stageEvents.type, 'turn_claim'),
          gte(stageEvents.createdAt, windowStart),
        ),
      )
      .orderBy(desc(stageEvents.createdAt))
      .limit(20)

    const inWindow = competingClaims.filter((c) => {
      const t = c.createdAt?.getTime() ?? 0
      return t >= windowStart.getTime() && t <= windowEnd.getTime()
    })

    // Step 5: did anyone in this window already get a grant?
    const recentGrants = await db
      .select()
      .from(stageEvents)
      .where(
        and(
          eq(stageEvents.stageId, stageId),
          eq(stageEvents.type, 'turn_grant'),
          gt(stageEvents.createdAt, windowStart),
        ),
      )
      .orderBy(desc(stageEvents.createdAt))
      .limit(5)

    const claimIdsInWindow = new Set(
      inWindow.map((c) => (c.content as ClaimContent | null)?.claimId).filter(Boolean) as string[],
    )
    const grantForWindow = recentGrants.find((g) => {
      const c = g.content as GrantContent | null
      return c?.claimId && claimIdsInWindow.has(c.claimId)
    })

    if (grantForWindow) {
      const c = grantForWindow.content as GrantContent
      if (c.agentId === agent.id) {
        return Response.json({
          ok: true,
          granted: true,
          claimId: c.claimId,
          expiresAt: c.expiresAt,
        })
      }
      return Response.json(
        {
          ok: false,
          error: 'lost_to_concurrent_claim',
          grantedTo: c.agentId,
          expiresAt: c.expiresAt,
        },
        { status: 409 },
      )
    }

    // Step 6: deterministic winner pick
    const lru = await getLastSpokenMap(stageId)
    const winner = pickClaimWinner(inWindow, lru)
    if (!winner || winner.agentId !== agent.id) {
      return Response.json(
        {
          ok: false,
          error: 'lost_to_concurrent_claim',
          winnerAgentId: winner?.agentId ?? null,
        },
        { status: 409 },
      )
    }

    // Step 7: I won — write the grant. Race-protected by the deterministic election above
    // (every caller computes the same winner) plus the window-grant short-circuit on retry.
    const winnerClaimContent = winner.content as ClaimContent
    const grantedAt = new Date()
    const expiresAt = new Date(grantedAt.getTime() + GRANT_TTL_MS)
    const grantContent: GrantContent = {
      claimId: winnerClaimContent.claimId,
      agentId: agent.id,
      characterId: character?.id ?? null,
      grantedAt: grantedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }

    await db.insert(stageEvents).values({
      stageId,
      type: 'turn_grant',
      agentId: agent.id,
      characterId: character?.id ?? null,
      content: grantContent,
    })

    return Response.json({
      ok: true,
      granted: true,
      claimId: grantContent.claimId,
      expiresAt: grantContent.expiresAt,
      grantedAt: grantContent.grantedAt,
    })
  } catch (err) {
    console.error('[POST /api/v1/stages/:id/turn/claim]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
