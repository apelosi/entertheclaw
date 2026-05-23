import { createHash, randomBytes } from 'crypto'
import { isPendingInviteExpired } from '@/lib/agents/pending-enrollment'
import { db } from '@/lib/db/client'
import { agents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export function generateApiKey(): string {
  return `etc_live_${randomBytes(24).toString('hex')}`
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export function getApiKeyPrefix(key: string): string {
  // Returns first 16 chars + mask: "etc_live_xxxxxxxx••••"
  return key.substring(0, 16) + '••••'
}

export async function verifyAgentApiKey(request: Request) {
  const apiKey =
    request.headers.get('Authorization')?.replace('Bearer ', '') ??
    request.headers.get('x-api-key')

  if (!apiKey?.startsWith('etc_live_')) return null

  const hash = hashApiKey(apiKey)
  const result = await db
    .select()
    .from(agents)
    .where(eq(agents.apiKeyHash, hash))
    .limit(1)

  const agent = result[0]
  if (!agent) return null
  if (isPendingInviteExpired(agent)) return null
  return agent
}
