import { db } from '@/lib/db/client'
import { syncStageImageUrls } from '@/lib/db/sync-stage-image-urls-core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handle(request: Request) {
  const expected = process.env.CRON_SECRET
  if (expected) {
    const provided = request.headers.get('x-cron-secret')
    if (provided !== expected) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const result = await syncStageImageUrls(db)
    return Response.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron/sync-stage-images]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}
