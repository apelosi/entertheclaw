/** Parse Neon host from a postgres connection string. */
export function parseDbHost(databaseUrl: string): string {
  const normalized = databaseUrl.replace(/^postgres(ql)?:/, 'http:')
  return new URL(normalized).hostname
}

/**
 * Read DATABASE_URL at runtime. Bracket access avoids Next.js/webpack build-time
 * inlining of `process.env.DATABASE_URL` into the server bundle.
 */
export function readDatabaseUrl(): string {
  const url = process.env['DATABASE_URL']
  if (!url) {
    throw new Error('DATABASE_URL is not set')
  }
  return url
}

export function readDatabaseHost(): string {
  return parseDbHost(readDatabaseUrl())
}
