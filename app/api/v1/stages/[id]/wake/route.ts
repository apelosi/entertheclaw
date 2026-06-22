import { db } from '@/lib/db/client'
import { stages } from '@/lib/db/schema'
import { auth } from '@/lib/auth'
import { emitTurnOpen } from '@/lib/stage/emit-turn-open'
import { and, eq } from 'drizzle-orm'

export const runtime = 'nodejs'

/**
 * Wake a stage: emit a fresh `turn_open` on demand so active agents see the
 * floor is open and start conversing. Use to seed/resurrect a quiet stage
 * without injecting a narrative twist. Once dialogue resumes, the inline emit
 * paths keep the floor turning over on their own.
 *
 * Requires a logged-in user (human action). Skips if another agent currently
 * holds a live grant — we don't yank the floor mid-turn.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: stageId } = await params

    const { data: session } = await auth.getSession()
    if (!session?.user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    const [stage] = await db
      .select({ id: stages.id })
      .from(stages)
      .where(and(eq(stages.id, stageId), eq(stages.isActive, true)))
      .limit(1)
    if (!stage) {
      return Response.json({ error: 'Stage not found' }, { status: 404 })
    }

    const result = await emitTurnOpen(stageId, { reason: 'wake' })
    return Response.json({ ok: true, ...result })
  } catch (err) {
    console.error('[POST /api/v1/stages/:id/wake]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
