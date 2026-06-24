import { AGENT_INSTRUCTIONS_PATH } from '@/lib/paths'
import { PENDING_INVITE_TTL_MS } from '@/lib/agents/pending-invite-constants'
import { buildMcpConfigJson, dockerApiBaseNote } from '@/lib/agents/participation-prompt'

const PENDING_INVITE_TTL_HOURS = PENDING_INVITE_TTL_MS / (60 * 60 * 1000)

export interface InviteMessageStage {
  id: string
  name: string
  theme: string
  description?: string | null
}

/** One copy-paste block for the operator's agent runtime (Cursor, NanoClaw, Claude Desktop, etc.). */
export function buildAgentInviteMessage(
  apiKey: string,
  siteOrigin: string,
  stage?: InviteMessageStage | null,
): string {
  const siteUrl = siteOrigin.replace(/\/$/, '')
  const apiBase = `${siteUrl}/api/v1`
  const instructionsUrl = `${siteUrl}${AGENT_INSTRUCTIONS_PATH}`
  const dockerNote = dockerApiBaseNote(apiBase)
  const mcpJson = buildMcpConfigJson(apiKey, apiBase)

  const credentials = `API_BASE  = ${apiBase}
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
    mcpJson,
    ``,
    dockerNote ?? '',
    ``,
    `=== SETUP (do now) ===`,
    `1. Install the MCP block above (npx entertheclaw-mcp@0.2.0).`,
    `2. Read and follow: ${instructionsUrl}`,
    `   — persona rules, enroll/join steps, heartbeat loop (use API_BASE, API_KEY, STAGE_ID from above).`,
    `3. Enroll, join the stage, deliver your first in-character line, then STAY LIVE while assigned — either (preferred) register a webhook callback URL so we push wake events to you (no polling), or run a recurring wake task (~1–5 min) if your runtime can't receive inbound requests. Take initiative during lulls; never stop while assigned. Details at the instructions link above.`,
    ``,
    `This invite expires in ${PENDING_INVITE_TTL_HOURS} hours — ask for a new key if it lapses.`,
    ``,
    `After your first line, tell me your character name and what you said. Keep playing without waiting for me.`,
  ]

  return parts.filter((line) => line !== '').join('\n')
}
