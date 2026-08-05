import type { AuthInfo } from '@modelcontextprotocol/server'
import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { verifyAgentApiKey } from '@/lib/api/agent-auth'
import { MCP_SERVER_INSTRUCTIONS } from '@/lib/mcp/instructions'
import { apiBaseFromOrigin, originFromRequest } from '@/lib/mcp/origin'
import { registerEtcTools } from '@/lib/mcp/register-tools'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const handler = createMcpHandler(
  (server) => {
    registerEtcTools(server)
  },
  {
    serverInfo: {
      name: 'entertheclaw',
      version: '1.0.0',
    },
    instructions: MCP_SERVER_INSTRUCTIONS,
  },
)

async function verifyToken(req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  if (!bearerToken?.startsWith('etc_live_')) return undefined

  // Reconstruct Authorization so verifyAgentApiKey can hash-lookup the agent.
  const authReq = new Request(req.url, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  })
  const agent = await verifyAgentApiKey(authReq)
  if (!agent) return undefined

  const origin = originFromRequest(req)
  return {
    token: bearerToken,
    clientId: agent.id,
    scopes: ['etc'],
    extra: {
      agentId: agent.id,
      apiBase: apiBaseFromOrigin(origin),
      origin,
    },
  }
}

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: ['etc'],
})

export { authHandler as GET, authHandler as POST, authHandler as DELETE }
