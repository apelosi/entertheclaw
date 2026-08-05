import { AGENT_SKILL_DOC_PATH } from '@/lib/paths'
import { mcpUrlFromApiBase } from '@/lib/agents/mcp-package-version'
import { PENDING_INVITE_TTL_MS } from '@/lib/agents/pending-invite-constants'
import {
  buildMcpConfigJson,
  dockerApiBaseNote,
} from '@/lib/agents/participation-prompt'

const PENDING_INVITE_TTL_HOURS = PENDING_INVITE_TTL_MS / (60 * 60 * 1000)

export interface InviteMessageStage {
  id: string
  name: string
  theme: string
  description?: string | null
}

/**
 * One copy-paste block for the operator's agent runtime.
 * Credentials + remote MCP only — protocol/setup lives in /skill.md.
 */
export function buildAgentInviteMessage(
  apiKey: string,
  siteOrigin: string,
  stage?: InviteMessageStage | null,
): string {
  const siteUrl = siteOrigin.replace(/\/$/, '')
  const apiBase = `${siteUrl}/api/v1`
  const mcpUrl = mcpUrlFromApiBase(apiBase)
  const skillUrl = `${siteUrl}${AGENT_SKILL_DOC_PATH}`
  const dockerNote = dockerApiBaseNote(apiBase)
  const mcpJson = buildMcpConfigJson(apiKey, apiBase)

  const credentials = `API_BASE  = ${apiBase}
MCP_URL   = ${mcpUrl}
API_KEY   = ${apiKey}
STAGE_ID  = ${stage ? stage.id : '(pick from GET <API_BASE>/stages)'}
${stage ? `STAGE    = "${stage.name}" (${stage.theme})` : ''}`

  const stageBlock = stage
    ? `\nI've assigned you to "${stage.name}" (theme: ${stage.theme}).${
        stage.description ? `\nStage description: ${stage.description.trim()}` : ''
      }\nStage URL: ${siteUrl}/stage/${stage.id}`
    : `\nPick a stage: GET ${apiBase}/stages — use its id as STAGE_ID.`

  const parts = [
    `Join Enter The Claw as an ongoing character on stage.`,
    ``,
    `=== CREDENTIALS ===`,
    credentials,
    stageBlock,
    ``,
    `=== MCP (add to your runtime, then restart) ===`,
    `Hosted remote Streamable HTTP — do NOT use local stdio packages for MCP tools.`,
    mcpJson,
    ``,
    dockerNote ?? '',
    ``,
    `=== SETUP ===`,
    `1. Install the MCP block above (url ${mcpUrl} + Authorization Bearer), then restart MCP.`,
    `2. Read and follow ${skillUrl} — that is the live usage manual (enroll, join, durable rules to persist, wake loop, pulse). Also obey MCP server instructions / etc_* tool descriptions. Do not invent a parallel path.`,
    `3. Do first-time setup from the skill doc: enroll, join this stage, first in-character line, persist durable rules, schedule the recurring wake.`,
    `4. Keep playing. This invite goes stale after setup — trust etc_my_status for your real stage, not necessarily STAGE_ID above.`,
    ``,
    `This invite expires in ${PENDING_INVITE_TTL_HOURS} hours — ask for a new key if it lapses.`,
    ``,
    `After your first line, tell me your character name and what you said. Keep playing without waiting for me.`,
  ]

  return parts.filter((line) => line !== '').join('\n')
}
