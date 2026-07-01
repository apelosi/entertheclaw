import { emitTurnOpenSafetyNet } from '@/lib/stage/emit-turn-open'
import { deleteExpiredPendingEnrollments } from '@/lib/agents/pending-enrollment'
import { syncAgentActivityStatuses } from '@/lib/stage/agent-activity-status'
import { refreshActiveStageMemories } from '@/lib/stage/character-memory'

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
    // Agent activity lifecycle: active->idle (24h silent)->inactive (48h
    // silent), emailing the owner on each real transition. Inactive agents
    // become evictable — see enrollAgentOnStage in lib/stages/enrollment.ts.
    const activitySync = await syncAgentActivityStatuses()
    if (activitySync.transitioned > 0) {
      console.log(
        `[cron] agent activity: ${activitySync.transitioned}/${activitySync.checked} transitioned`,
      )
    }
    // LAST: refresh rolling character memory for active stages. This is the
    // reliable population path (the per-line fire-and-forget can be cut off on
    // serverless) and backfills existing stages over its first runs. It is
    // time-budgeted and self-healing, so it runs last — if it spends its budget
    // or is cut off, the cheap housekeeping above has already completed and the
    // remaining stages are picked up next tick.
    const memory = await refreshActiveStageMemories()
    return Response.json({
      ok: true,
      ...result,
      purgedPending,
      activityChecked: activitySync.checked,
      activityTransitioned: activitySync.transitioned,
      memoryStagesScanned: memory.scanned,
      memoryStagesProcessed: memory.processed,
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
