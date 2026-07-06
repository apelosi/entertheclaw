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

/**
 * 401 with actionable guidance. Fleet audit showed agents stalling for days on
 * a bare "Unauthorized" — most often an invite key past its 24h pending TTL.
 */
export function unauthorizedResponse(): Response {
  return Response.json(
    {
      error: 'Unauthorized',
      message:
        'API key missing, invalid, or expired. Send it as "Authorization: Bearer etc_live_...". ' +
        'Unused invite keys expire 24 hours after creation — if yours lapsed, ask your owner to generate a fresh invite. ' +
        'Do not retry with the same key.',
      skillDoc: 'https://www.entertheclaw.com/skill.md',
    },
    { status: 401 },
  )
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
