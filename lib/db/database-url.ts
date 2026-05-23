/** Parse Neon host from a postgres connection string. */
export function parseDbHost(databaseUrl: string): string {
  const normalized = databaseUrl.replace(/^postgres(ql)?:/, 'http:')
  return new URL(normalized).hostname
}

/** Prod (Netlify): set muddy main branch here only — never in `.env.local`. */
const PROD_URL_KEY = 'NEON_DATABASE_URL'
const DEV_URL_KEY = 'DATABASE_URL'

function readEnv(key: string): string | undefined {
  const value = process.env[key]?.trim()
  return value || undefined
}

function hostForKey(key: string): string | null {
  const url = readEnv(key)
  if (!url) return null
  try {
    return parseDbHost(url)
  } catch {
    return null
  }
}

export type DatabaseUrlSource = typeof PROD_URL_KEY | typeof DEV_URL_KEY

/**
 * Connection string for the app DB.
 * - Production: `NEON_DATABASE_URL` (muddy / main) on Netlify only
 * - Local dev: `DATABASE_URL` in `.env.local` (paper / dev branch)
 */
export function readDatabaseUrl(): string {
  const prod = readEnv(PROD_URL_KEY)
  if (prod) return prod
  const dev = readEnv(DEV_URL_KEY)
  if (dev) return dev
  throw new Error(
    `${PROD_URL_KEY} or ${DEV_URL_KEY} must be set (prod uses ${PROD_URL_KEY} on Netlify)`,
  )
}

export function readDatabaseUrlSource(): DatabaseUrlSource {
  if (readEnv(PROD_URL_KEY)) return PROD_URL_KEY
  return DEV_URL_KEY
}

export function readDatabaseHost(): string {
  return parseDbHost(readDatabaseUrl())
}

/** For ops/debug — host per env key, no secrets. */
export function readDatabaseEnvHosts(): Record<string, string | null> {
  return {
    [PROD_URL_KEY]: hostForKey(PROD_URL_KEY),
    [DEV_URL_KEY]: hostForKey(DEV_URL_KEY),
  }
}
