/**
 * Safe read-only check — does not delete anything.
 *
 *   bun run db:check-database -- --database-url='postgresql://...'
 */
import { neon } from '@neondatabase/serverless'
import { logDatabaseTarget, resolveDatabaseUrlFromArgv } from './resolve-database-url'

async function main() {
  const { url, host } = resolveDatabaseUrlFromArgv()
  logDatabaseTarget(host)

  const sql = neon(url)

  const [stages] = await sql`SELECT count(*)::int AS n FROM stages`
  const [agents] = await sql`SELECT count(*)::int AS n FROM agents`
  const [dialogue] = await sql`
    SELECT count(*)::int AS n FROM stage_events WHERE type = 'dialogue'
  `
  const [openings] = await sql`
    SELECT count(*)::int AS n FROM stage_events
    WHERE type = 'scene_change'
      AND agent_id IS NULL
      AND content->>'reason' = 'Opening scene'
  `

  console.log('\nWhat is in this database right now:')
  console.log(`  stages (need 20 for production):         ${stages.n}`)
  console.log(`  agents (want 0 after cleanup):           ${agents.n}`)
  console.log(`  dialogue lines (want 0 after cleanup):   ${dialogue.n}`)
  console.log(`  origin stories (want 20 after cleanup):  ${openings.n}`)
  console.log('\nNo changes were made.')
}

main().catch((err) => {
  if (err instanceof Error && err.message.includes('Missing --database-url')) {
    console.error(err.message)
  } else {
    const code = (err as { code?: string })?.code
    if (code === '42P01') {
      console.error('\n✓ This connection works, but this database is EMPTY (no `stages` table).')
      console.error('  That is expected for Neon **main** / muddy-wave if migrations never ran here.')
      console.error('  The live site does NOT use this branch — do not keep running commands against this URL.')
      console.error('\n  To inspect the database the site actually uses, run the same command with')
      console.error('  your **dev** connection string from .env.local (polished-paper), or use Neon SQL Editor')
      console.error('  on the branch where `SELECT count(*) FROM stages` returns 20.\n')
    } else {
      console.error(err)
    }
  }
  process.exit(1)
})
