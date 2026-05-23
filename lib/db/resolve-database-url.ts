/**
 * Production/maintenance CLI scripts must pass the database explicitly.
 * We do NOT read DATABASE_URL from .env.local (Bun loads that for dev).
 *
 *   bun run db:check-database -- --database-url='postgresql://...'
 */
import { parseDbHost } from './database-url'

export { parseDbHost } from './database-url'

function readDatabaseUrlFlag(): string | null {
  const prefix = '--database-url='
  const arg = process.argv.find((a) => a.startsWith(prefix))
  if (!arg) return null
  const value = arg.slice(prefix.length).trim()
  return value || null
}

/**
 * Connect URL from `--database-url=` only (not .env.local, not shell DATABASE_URL).
 */
export function resolveDatabaseUrlFromArgv(): { url: string; host: string } {
  const url = readDatabaseUrlFlag()
  if (!url) {
    throw new Error(
      'Missing --database-url=...\n\n' +
        'These scripts never use .env.local (that is dev).\n\n' +
        'Example:\n' +
        "  bun run --no-env-file db:check-database -- --database-url='postgresql://...'\n\n" +
        '(Use --no-env-file so Bun does not load .env.local — that line is not your connection.)',
    )
  }
  return { url, host: parseDbHost(url) }
}

export function logDatabaseTarget(host: string): void {
  console.log(`Connecting to: ${host}`)
  console.log('  (only from --database-url= on this command)')
}
