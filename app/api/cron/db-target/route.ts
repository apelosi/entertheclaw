import { neon } from '@neondatabase/serverless'
import { readDatabaseHost, readDatabaseUrl } from '@/lib/db/database-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Ops-only: which Neon host this deploy reads at runtime (no secrets). */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
  if (expected) {
    const provided = request.headers.get('x-cron-secret')
    if (provided !== expected) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const host = readDatabaseHost()
  try {
    const sql = neon(readDatabaseUrl())
    const [stages] = await sql`SELECT count(*)::int AS n FROM stages`
    const [agents] = await sql`SELECT count(*)::int AS n FROM agents`
    const [openings] = await sql`
      SELECT count(*)::int AS n FROM stage_events
      WHERE type = 'scene_change'
        AND agent_id IS NULL
        AND content->>'reason' = 'Opening scene'
    `
    return Response.json({
      host,
      stages: stages.n,
      agents: agents.n,
      originStories: openings.n,
    })
  } catch (err) {
    const code = (err as { code?: string })?.code
    return Response.json({ host, error: 'Database query failed', code }, { status: 500 })
  }
}
