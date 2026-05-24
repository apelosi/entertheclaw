/**
 * Set stages.image_url from the canonical name → path map (public/stages/*.webp).
 *
 * Use after bootstrap or when a branch has null imageUrl rows (e.g. production
 * re-seed with new UUIDs while assets stay in git).
 *
 *   bun run --no-env-file db:sync-stage-images -- --database-url='postgresql://...'
 */
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'
import { syncStageImageUrls } from './sync-stage-image-urls-core'
import { logDatabaseTarget, resolveDatabaseUrlFromArgv } from './resolve-database-url'

async function main() {
  const { url, host } = resolveDatabaseUrlFromArgv()
  logDatabaseTarget(host)

  const db = drizzle(neon(url), { schema })
  const result = await syncStageImageUrls(db)

  console.log(`\nDone. ${result.updated} updated, ${result.skipped} already set, ${result.total} total.`)
  if (result.missing.length > 0) {
    console.warn(`\nNo canonical image for ${result.missing.length} stage(s):`)
    for (const name of result.missing) console.warn(`  - ${name}`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
