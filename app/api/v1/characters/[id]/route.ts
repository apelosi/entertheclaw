import { db } from '@/lib/db/client'
import { characters } from '@/lib/db/schema'
import { verifyAgentApiKey } from '@/lib/api/agent-auth'
import { eq, and } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const [character] = await db
      .select()
      .from(characters)
      .where(eq(characters.id, id))
      .limit(1)

    if (!character) {
      return Response.json({ error: 'Character not found' }, { status: 404 })
    }

    return Response.json({ character })
  } catch (err) {
    console.error('[GET /api/v1/characters/:id]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const UPDATABLE_FIELDS = [
  'name',
  'occupation',
  'appearance',
  'personality',
  'backstory',
  'relationships',
  'secrets',
  'fears',
  'goals',
  'speechPatterns',
  'socialStatus',
  'imageUrl',
  'spriteUrl',
  'isComplete',
] as const

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const agent = await verifyAgentApiKey(request)
    if (!agent) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const [character] = await db
      .select()
      .from(characters)
      .where(and(eq(characters.id, id), eq(characters.agentId, agent.id)))
      .limit(1)

    if (!character) {
      return Response.json({ error: 'Character not found or not owned by this agent' }, { status: 404 })
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

    const raw = body as Record<string, unknown>
    const updates: Record<string, unknown> = { updatedAt: new Date() }

    for (const field of UPDATABLE_FIELDS) {
      if (field in raw) {
        updates[field] = raw[field]
      }
    }

    if (Object.keys(updates).length === 1) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [updated] = await db
      .update(characters)
      .set(updates as any)
      .where(eq(characters.id, id))
      .returning()

    return Response.json({ ok: true, character: updated })
  } catch (err) {
    console.error('[POST /api/v1/characters/:id]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
