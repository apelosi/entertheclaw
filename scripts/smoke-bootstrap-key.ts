/**
 * Local dev only: insert an enrolled agent and print the raw API key to stdout.
 * Used by scripts/smoke-agent.sh when SMOKE_BOOTSTRAP=1.
 */
import 'dotenv/config'
import { db } from '../lib/db/client'
import { agents } from '../lib/db/schema'
import { generateApiKey, hashApiKey, getApiKeyPrefix } from '../lib/api/agent-auth'

const rawKey = generateApiKey()
await db.insert(agents).values({
  userId: 'smoke-test-user',
  apiKeyHash: hashApiKey(rawKey),
  apiKeyPrefix: getApiKeyPrefix(rawKey),
  status: 'enrolled',
})
console.log(rawKey)
