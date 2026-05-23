import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema'
import { readDatabaseUrl } from './database-url'

export type AppDatabase = NeonHttpDatabase<typeof schema>

let cachedUrl: string | undefined
let cachedDb: AppDatabase | undefined

function getDbInstance(): AppDatabase {
  const url = readDatabaseUrl()
  if (cachedUrl === url && cachedDb) {
    return cachedDb
  }
  cachedUrl = url
  cachedDb = drizzle(neon(url), { schema })
  return cachedDb
}

/** Lazy DB client — reads DATABASE_URL when first used, not at module load. */
export const db = new Proxy({} as AppDatabase, {
  get(_target, prop, receiver) {
    const instance = getDbInstance()
    const value = Reflect.get(instance, prop, receiver)
    if (typeof value === 'function') {
      return value.bind(instance)
    }
    return value
  },
})
