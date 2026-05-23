/**
 * Ensure every stage has exactly one origin story (opening scene_change).
 * Run on production before db:wipe-runtime.
 *
 *   bun run db:ensure-origin-stories -- --database-url='postgresql://...' --apply
 */
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'
import {
  originStoriesReady,
  prepareOriginStories,
  printOriginAudit,
} from './ensure-opening-scene-events'
import { logDatabaseTarget, resolveDatabaseUrlFromArgv } from './resolve-database-url'

async function main() {
  const apply = process.argv.includes('--apply')
  const { url, host } = resolveDatabaseUrlFromArgv()
  logDatabaseTarget(host)

  const db = drizzle(neon(url), { schema })

  if (!apply) {
    const { auditOriginStories } = await import('./ensure-opening-scene-events')
    const audit = await auditOriginStories(db)
    printOriginAudit(audit)
    if (originStoriesReady(audit)) {
      console.log('\nAll stages ready. No changes needed.')
      return
    }
    console.log('\nDry run. Re-run with --apply to migrate/dedupe/insert openings.')
    console.log('If columns are missing, run: bun run db:seed-scenes -- --database-url=... (same URL).')
    process.exit(1)
  }

  const result = await prepareOriginStories(db)
  console.log(`Migrated legacy scene_change: ${result.migrated}`)
  console.log(
    `Openings: ${result.openings.alreadyHad} already had, ${result.openings.inserted} inserted, ${result.openings.noColumns} missing columns`,
  )
  console.log(`Deduped extra openings: ${result.deduped}`)
  printOriginAudit(result.audit)

  if (!originStoriesReady(result.audit)) {
    console.error('\nNot all stages have an origin story. Run db:seed-scenes then retry.')
    process.exit(1)
  }

  console.log('\nEvery stage has exactly one origin story.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
