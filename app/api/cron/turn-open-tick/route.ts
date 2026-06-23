import { emitTurnOpenSafetyNet } from '@/lib/stage/emit-turn-open'
import { deleteExpiredPendingEnrollments } from '@/lib/agents/pending-enrollment'
import { flagInactiveParticipants } from '@/lib/stage/inactivity-nudge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Cron-like endpoint: safety-net scan for stages that should have a fresh
 * `turn_open` but don't (silently expired grants, cold-quiet stages). Inline
 * emits (dialogue, twist, join) cover the common cases; this catches gaps.
 *
 * Auth model:
 *   - In production: requires header `x-cron-secret` matching env CRON_SECRET.
 *   - If CRON_SECRET is unset (local dev): allows unauthenticated calls.
 *
 * Configure Netlify scheduled functions or any cron service to GET this URL
 * at your preferred cadence (1 min on Netlify, faster on Upstash QStash etc.).
 */
async function handle(request: Request) {
  const expected = process.env.CRON_SECRET
  if (expected) {
    const provided = request.headers.get('x-cron-secret')
    if (provided !== expected) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  try {
    const result = await emitTurnOpenSafetyNet()
    // Periodic housekeeping: purge invite rows that never completed enrollment
    // and are past their TTL (they can't authenticate anyway).
    const purgedPending = await deleteExpiredPendingEnrollments()
    // Flag (review only — never auto-pull) participants inactive 24h+. Surfaces
    // even fully-dormant agents the heartbeat nudge can't reach.
    const flaggedInactive = await flagInactiveParticipants()
    if (flaggedInactive.length > 0) {
      console.log(
        `[cron] flagged ${flaggedInactive.length} inactive agent(s) (24h+, review only): ` +
          flaggedInactive.map((f) => `${f.name ?? f.agentId}@${f.stageId.slice(0, 8)}`).join(', '),
      )
    }
    return Response.json({
      ok: true,
      ...result,
      purgedPending,
      flaggedInactive: flaggedInactive.length,
    })
  } catch (err) {
    console.error('[cron/turn-open-tick]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}
