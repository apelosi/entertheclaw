/**
 * Postgres `bytea` column type for Drizzle.
 *
 * Drizzle's pg-core doesn't ship a built-in bytea helper, so we use customType.
 * The @neondatabase/serverless HTTP driver returns bytea values as Buffer
 * (or Uint8Array depending on version); the wrapper accepts both on write.
 */
import { customType } from 'drizzle-orm/pg-core'

export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea'
  },
  toDriver(value: Buffer): Buffer {
    return value
  },
  fromDriver(value: Buffer | Uint8Array | string): Buffer {
    if (Buffer.isBuffer(value)) return value
    if (value instanceof Uint8Array) return Buffer.from(value)
    // Postgres can return bytea as "\\x..." hex string with some drivers
    if (typeof value === 'string' && value.startsWith('\\x')) {
      return Buffer.from(value.slice(2), 'hex')
    }
    if (typeof value === 'string') return Buffer.from(value, 'utf8')
    return Buffer.from(value as ArrayBuffer)
  },
})
