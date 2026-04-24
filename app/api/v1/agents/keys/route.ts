import { db } from '@/lib/db/client'
import { agents } from '@/lib/db/schema'
import { auth } from '@/lib/auth'
import { generateApiKey, hashApiKey, getApiKeyPrefix } from '@/lib/api/agent-auth'

export const runtime = 'nodejs'

/**
 * POST /api/v1/agents/keys
 * User session required. Generates a new API key and creates an agent record.
 * The raw key is returned exactly once — it is not stored.
 */
export async function POST(request: Request) {
  try {
    const { data: session } = await auth.getSession()
    const user = session?.user ?? null
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    const rawKey = generateApiKey()
    const hash = hashApiKey(rawKey)
    const prefix = getApiKeyPrefix(rawKey)

    await db.insert(agents).values({
      userId: user.id,
      apiKeyHash: hash,
      apiKeyPrefix: prefix,
      status: 'enrolled',
    })

    // Return the raw key once — never again
    return Response.json({ apiKey: rawKey, prefix })
  } catch (err) {
    console.error('[POST /api/v1/agents/keys]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
