/**
 * Strip historical `content.snapshot` from `turn_open` rows.
 *
 * New emits already persist slim payloads (PR #148). Old rows still hold
 * unused webhook snapshots (~364 MB content / ~417 MB TOAST on prod as of
 * 2026-08-17). Removing the key rewrites those rows so the working set can
 * shrink. This does not delete events and does not run VACUUM FULL.
 * After a prod `--yes`, a plain `VACUUM (ANALYZE) stage_events` reclaimed
 * dead TOAST (417 MB → 5.5 MB on 2026-08-17).
 *
 * Default is dry-run. Requires `--database-url=` (never `.env.local`).
 *
 *   bun run --no-env-file db:strip-turn-open-snapshots -- --database-url='postgresql://...'
 *   bun run --no-env-file db:strip-turn-open-snapshots -- --database-url='...' --yes
 *
 * Production writes need explicit owner permission (VV-20).
 */
import { neon } from '@neondatabase/serverless'
import { logDatabaseTarget, resolveDatabaseUrlFromArgv } from './resolve-database-url'

export const STRIP_TURN_OPEN_SNAPSHOT_BATCH = 500

type CountRow = {
  rows: string
  with_snapshot: string
  content_bytes: string | null
  snapshot_bytes: string | null
}

async function main() {
  const apply = process.argv.includes('--yes')
  const { url, host } = resolveDatabaseUrlFromArgv()
  logDatabaseTarget(host)

  const sql = neon(url)

  const [stats] = (await sql`
    SELECT
      count(*)::text AS rows,
      count(*) FILTER (
        WHERE jsonb_typeof(content) = 'object' AND content ? 'snapshot'
      )::text AS with_snapshot,
      sum(pg_column_size(content))::text AS content_bytes,
      sum(pg_column_size(content)) FILTER (
        WHERE jsonb_typeof(content) = 'object' AND content ? 'snapshot'
      )::text AS snapshot_bytes
    FROM stage_events
    WHERE type = 'turn_open'
  `) as CountRow[]

  const fat = Number(stats.with_snapshot)
  const snapshotBytes = Number(stats.snapshot_bytes ?? 0)
  console.log(`turn_open rows:           ${stats.rows}`)
  console.log(`rows with snapshot key:   ${fat}`)
  console.log(`turn_open content bytes:  ${stats.content_bytes ?? '0'}`)
  console.log(`fat-row content bytes:    ${stats.snapshot_bytes ?? '0'} (${(snapshotBytes / 1024 / 1024).toFixed(1)} MB)`)

  if (fat === 0) {
    console.log('Nothing to strip.')
    return
  }

  if (!apply) {
    console.log(
      `\nDry run. Pass --yes to UPDATE content = content - 'snapshot' in batches of ${STRIP_TURN_OPEN_SNAPSHOT_BATCH}.`,
    )
    console.log('Does not VACUUM FULL. Does not delete rows.')
    return
  }

  let stripped = 0
  for (;;) {
    const updated = (await sql`
      UPDATE stage_events
      SET content = content - 'snapshot'
      WHERE id IN (
        SELECT id
        FROM stage_events
        WHERE type = 'turn_open'
          AND jsonb_typeof(content) = 'object'
          AND content ? 'snapshot'
        LIMIT ${STRIP_TURN_OPEN_SNAPSHOT_BATCH}
      )
      RETURNING id
    `) as { id: string }[]
    if (updated.length === 0) break
    stripped += updated.length
    console.log(`stripped ${stripped} / ${fat}`)
  }

  console.log(`Done. Stripped snapshot key from ${stripped} turn_open rows.`)
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
