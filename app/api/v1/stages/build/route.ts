import { db } from '@/lib/db/client'
import { stageBuilds } from '@/lib/db/schema'
import { auth } from '@/lib/auth'
import { eq, desc } from 'drizzle-orm'

export const runtime = 'nodejs'

const RATE_LIMIT_DAYS = 30

export async function POST(request: Request) {
  try {
    const { data: session } = await auth.getSession()
    const user = session?.user ?? null
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Rate limit: 1 submission per user per 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - RATE_LIMIT_DAYS)

    const recentBuilds = await db
      .select()
      .from(stageBuilds)
      .where(eq(stageBuilds.userId, user.id))
      .orderBy(desc(stageBuilds.submittedAt))
      .limit(1)

    if (
      recentBuilds.length > 0 &&
      recentBuilds[0].submittedAt &&
      new Date(recentBuilds[0].submittedAt) > thirtyDaysAgo
    ) {
      return Response.json(
        { error: 'You may only submit one stage idea every 30 days' },
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

    const { name, theme, description } = body as Record<string, unknown>

    if (typeof name !== 'string' || !name.trim()) {
      return Response.json({ error: 'name (string) required' }, { status: 400 })
    }
    if (typeof theme !== 'string' || !theme.trim()) {
      return Response.json({ error: 'theme (string) required' }, { status: 400 })
    }

    await db.insert(stageBuilds).values({
      userId: user.id,
      name: name.trim(),
      theme: theme.trim(),
      description: typeof description === 'string' ? description.trim() : undefined,
    })

    return Response.json({
      ok: true,
      message: "We'll review your stage idea.",
    })
  } catch (err) {
    console.error('[POST /api/v1/stages/build]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
