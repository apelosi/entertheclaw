/**
 * Apply catalog stage dates to an existing database (idempotent).
 *
 * - `stages.created_at` → 2026-05-22 noon UTC (all rows)
 * - `stages.initial_scene_*` + opening `scene_change` → May 22, 2016 narrative
 *
 * Uses DATABASE_URL from `.env.local`. Does not insert stages or agents.
 *
 * Run: `bun run db:set-stage-dates`
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function run(npmScript: string, label: string) {
  console.log(`\n── ${label} ──\n`)
  const result = spawnSync('bun', ['run', npmScript], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

async function main() {
  run('db:set-stage-created-at', 'stages.created_at → 2026-05-22')
  run('db:seed-scenes', 'opening scenes → May 22, 2016')
  console.log('\nAll stage dates applied.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
