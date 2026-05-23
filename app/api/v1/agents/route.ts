import { db } from '@/lib/db/client'
import { agents } from '@/lib/db/schema'
import { verifyAgentApiKey } from '@/lib/api/agent-auth'
import { defaultAvatarUrl } from '@/lib/agents/default-avatars'
import { deleteOtherPendingEnrollments } from '@/lib/agents/pending-enrollment'
import {
  normalizeWebhookSecret,
  normalizeWebhookUrl,
} from '@/lib/agents/webhook-url'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

const VALID_AGENT_TYPES = [
  // ETC-native runtimes
  'nanoclaw',     // NanoClaw — lightweight ETC agent
  'openclaw',     // OpenClaw — self-hosted ETC agent
  'hermes',       // Hermes — fast messenger-style ETC agent
  // Popular external frameworks
  'cursor',       // Cursor IDE agent (Claude-powered)
  'claude_sdk',   // Anthropic Claude SDK / Claude Desktop
  'openai_sdk',   // OpenAI Agents SDK
  'langgraph',    // LangChain / LangGraph
  'crewai',       // CrewAI
  'autogen',      // Microsoft AutoGen
  'mastra',       // Mastra (TypeScript-first)
  'n8n',          // n8n workflow automation
  'custom',       // anything else
] as const

export async function POST(request: Request) {
  try {
    const agent = await verifyAgentApiKey(request)
    if (!agent) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (typeof body !== 'object' || body === null) {
      return Response.json({ error: 'Invalid body' }, { status: 400 })
    }

    const { name, agentType, imageUrl, webhookUrl, webhookSecret } =
      body as Record<string, unknown>

    if (typeof name !== 'string' || !name.trim()) {
      return Response.json({ error: 'name (string) required' }, { status: 400 })
    }

    const resolvedType =
      typeof agentType === 'string' &&
      VALID_AGENT_TYPES.includes(agentType as (typeof VALID_AGENT_TYPES)[number])
        ? agentType
        : 'custom'

    const resolvedImageUrl =
      typeof imageUrl === 'string' && imageUrl.trim()
        ? imageUrl.trim()
        : defaultAvatarUrl(agent.id)

    const urlNorm = normalizeWebhookUrl(webhookUrl)
    if (!urlNorm.ok) {
      return Response.json({ error: urlNorm.error }, { status: 400 })
    }
    const secretNorm = normalizeWebhookSecret(webhookSecret)
    if (!secretNorm.ok) {
      return Response.json({ error: secretNorm.error }, { status: 400 })
    }

    await db
      .update(agents)
      .set({
        name: name.trim(),
        agentType: resolvedType,
        imageUrl: resolvedImageUrl,
        status: 'active',
        ...(webhookUrl !== undefined ? { webhookUrl: urlNorm.url } : {}),
        ...(webhookSecret !== undefined
          ? { webhookSecret: secretNorm.secret }
          : {}),
      })
      .where(eq(agents.id, agent.id))

    const removedPending = await deleteOtherPendingEnrollments(agent.userId, agent.id)

    return Response.json({ ok: true, agentId: agent.id, removedPendingEnrollments: removedPending })
  } catch (err) {
    console.error('[POST /api/v1/agents]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
