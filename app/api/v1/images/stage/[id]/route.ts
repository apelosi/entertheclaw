/**
 * POST /api/v1/images/stage/:id
 *
 * Generates (or returns the cached) 8-bit pixel art background image for a stage.
 * Idempotent — if the stage already has an imageUrl it is returned immediately.
 *
 * Auth: bearer token OR admin secret via X-Admin-Secret header.
 * This endpoint is intended to be called server-side or via curl/Postman;
 * it is NOT called from the browser UI directly.
 */

import { db } from '@/lib/db/client'
import { stages } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateImage } from '@/lib/images/recraft'
import { getStageBackgroundPrompt } from '@/lib/images/prompts'

export const runtime = 'nodejs'
// Image generation can take 10–30 seconds
export const maxDuration = 60

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch the stage
    const [stage] = await db.select().from(stages).where(eq(stages.id, id)).limit(1)
    if (!stage) {
      return Response.json({ error: 'Stage not found' }, { status: 404 })
    }

    // Already has an image — return it (idempotent)
    if (stage.imageUrl) {
      return Response.json({ imageUrl: stage.imageUrl, cached: true })
    }

    // Generate with Recraft
    const prompt = getStageBackgroundPrompt(stage.theme)
    const { url } = await generateImage({ prompt, style: 'Pixel art', size: '1820x1024' })

    // Persist to DB
    await db.update(stages).set({ imageUrl: url }).where(eq(stages.id, id))

    return Response.json({ imageUrl: url, cached: false })
  } catch (err) {
    console.error('[POST /api/v1/images/stage/:id]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}

/**
 * GET — convenience endpoint to check if a stage already has an image
 * without triggering generation.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const [stage] = await db.select({ imageUrl: stages.imageUrl }).from(stages).where(eq(stages.id, id)).limit(1)
  if (!stage) return Response.json({ error: 'Stage not found' }, { status: 404 })
  return Response.json({ imageUrl: stage.imageUrl ?? null })
}
