import { db } from '@/lib/db/client'
import { twists, stageEvents, stages } from '@/lib/db/schema'
import { auth } from '@/lib/auth'
import { eq, and, desc } from 'drizzle-orm'

export const runtime = 'nodejs'

const STAGE_COOLDOWN_MS = 6 * 60 * 1000 // 6 minutes
const USER_COOLDOWN_MS = 60 * 60 * 1000 // 60 minutes

export async function POST(
  request: Request,
  { params }: { params: Promise<{ stageId: string }> }
) {
  try {
    const { stageId } = await params

    // Require user session (not agent)
    const { data: session } = await auth.getSession()
    const user = session?.user ?? null
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify stage exists
    const [stage] = await db
      .select()
      .from(stages)
      .where(and(eq(stages.id, stageId), eq(stages.isActive, true)))
      .limit(1)

    if (!stage) {
      return Response.json({ error: 'Stage not found' }, { status: 404 })
    }

    const now = Date.now()

    // Stage cooldown: only one twist per stage per 6 minutes (from any user)
    const [lastStageTwist] = await db
      .select({ createdAt: twists.createdAt })
      .from(twists)
      .where(eq(twists.stageId, stageId))
      .orderBy(desc(twists.createdAt))
      .limit(1)

    if (
      lastStageTwist?.createdAt &&
      now - new Date(lastStageTwist.createdAt).getTime() < STAGE_COOLDOWN_MS
    ) {
      const remainingMs =
        STAGE_COOLDOWN_MS - (now - new Date(lastStageTwist.createdAt).getTime())
      return Response.json(
        {
          error: 'Stage twist cooldown active',
          cooldownRemainingMs: remainingMs,
        },
        { status: 429 }
      )
    }

    // User cooldown: same user can only send 1 twist per hour (across all stages)
    const [lastUserTwist] = await db
      .select({ createdAt: twists.createdAt })
      .from(twists)
      .where(eq(twists.userId, user.id))
      .orderBy(desc(twists.createdAt))
      .limit(1)

    if (
      lastUserTwist?.createdAt &&
      now - new Date(lastUserTwist.createdAt).getTime() < USER_COOLDOWN_MS
    ) {
      const remainingMs =
        USER_COOLDOWN_MS - (now - new Date(lastUserTwist.createdAt).getTime())
      return Response.json(
        {
          error: 'User twist cooldown active',
          cooldownRemainingMs: remainingMs,
        },
        { status: 429 }
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (typeof body !== 'object' || body === null) {
      return Response.json({ error: 'Invalid body' }, { status: 400 })
    }

    const { content } = body as Record<string, unknown>

    if (typeof content !== 'string' || !content.trim()) {
      return Response.json({ error: 'content (string) required' }, { status: 400 })
    }

    if (content.trim().length > 500) {
      return Response.json({ error: 'content exceeds 500 character limit' }, { status: 400 })
    }

    const trimmedContent = content.trim()

    // Insert twist + stage event in sequence
    const [twist] = await db
      .insert(twists)
      .values({
        stageId,
        userId: user.id,
        content: trimmedContent,
      })
      .returning()

    await db.insert(stageEvents).values({
      stageId,
      type: 'twist',
      userId: user.id,
      content: { text: trimmedContent, twistId: twist.id },
    })

    return Response.json({ ok: true, twistId: twist.id })
  } catch (err) {
    console.error('[POST /api/v1/twists/:stageId]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
