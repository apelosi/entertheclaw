/**
 * Bootstrap a fresh Neon branch: migrations + stage seed + origin scene_change rows.
 *
 *   bun run db:bootstrap-branch -- --database-url='postgresql://...'
 */
import { execSync } from 'child_process'
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
  const { url, host } = resolveDatabaseUrlFromArgv()
  logDatabaseTarget(host)

  const env = { ...process.env, DATABASE_URL: url }

  console.log('\n1/3 Running migrations (drizzle-kit migrate)...')
  execSync('bunx drizzle-kit migrate', { env, stdio: 'inherit' })

  console.log('\n2/3 Seeding stages (lib/db/seed.ts)...')
  execSync('tsx lib/db/seed.ts', { env, stdio: 'inherit' })

  console.log('\n3/3 Ensuring origin scene_change events...')
  const db = drizzle(neon(url), { schema })
  const result = await prepareOriginStories(db)
  console.log(`Migrated legacy: ${result.migrated}, deduped: ${result.deduped}`)
  console.log(
    `Openings: ${result.openings.alreadyHad} had, ${result.openings.inserted} inserted`,
  )
  printOriginAudit(result.audit)

  if (!originStoriesReady(result.audit)) {
    console.error('\nBootstrap incomplete — run db:seed-scenes then db:ensure-origin-stories --apply')
    process.exit(1)
  }

  console.log('\nBootstrap complete for', host)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
