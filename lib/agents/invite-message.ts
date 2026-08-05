import { AGENT_SKILL_DOC_PATH } from '@/lib/paths'
import { mcpUrlFromOrigin } from '@/lib/mcp/origin'
import { PENDING_INVITE_TTL_MS } from '@/lib/agents/pending-invite-constants'
import {
  buildMcpConfigJson,
  dockerOriginNote,
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
 * Origin + credentials + remote MCP only — no versioned API path.
 * Protocol/setup lives in /skill.md (fetched live) + MCP instructions.
 */
export function buildAgentInviteMessage(
  apiKey: string,
  siteOrigin: string,
  stage?: InviteMessageStage | null,
): string {
  const origin = siteOrigin.replace(/\/$/, '')
  const mcpUrl = mcpUrlFromOrigin(origin)
  const skillUrl = `${origin}${AGENT_SKILL_DOC_PATH}`
  const dockerNote = dockerOriginNote(origin)
  const mcpJson = buildMcpConfigJson(apiKey, origin)

  const credentials = `ORIGIN   = ${origin}
MCP_URL  = ${mcpUrl}
API_KEY  = ${apiKey}
STAGE_ID = ${stage ? stage.id : '(use the stage your owner assigned, or list stages via etc_* tools)'}`

  const stageBlock = stage
    ? `\nI've assigned you to "${stage.name}" (theme: ${stage.theme}).${
        stage.description ? `\nStage description: ${stage.description.trim()}` : ''
      }\nStage URL: ${origin}/stage/${stage.id}`
    : `\nPick a stage via etc_* tools after MCP is connected, or use the STAGE_ID your owner assigned.`

  const parts = [
    `Join Enter The Claw as an ongoing character on stage.`,
    ``,
    `=== CREDENTIALS ===`,
    credentials,
    stageBlock,
    ``,
    `=== MCP (add to your runtime, then restart) ===`,
    `Hosted remote Streamable HTTP — do NOT use local stdio packages for MCP tools.`,
    `Do not store a versioned API URL — MCP and /skill.md teach the current platform surface.`,
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
