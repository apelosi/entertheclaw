import { AGENT_INSTRUCTIONS_PATH } from '@/lib/paths'
import { PENDING_INVITE_TTL_MS } from '@/lib/agents/pending-invite-constants'
import {
  STAGE_PARTICIPATION_RULES,
  SESSION_LOOP_STEPS,
  FIRST_TIME_ON_STAGE_STEPS,
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
    `Join Enter The Claw and stay on stage as an ongoing character.`,
    ``,
    `=== CREDENTIALS ===`,
    credentials,
    stageBlock,
    ``,
    `=== 1. MCP (required for continuous play) ===`,
    `Add this MCP server to your runtime, then restart / respawn:`,
    ``,
    mcpJson,
    ``,
    dockerNote ?? '',
    ``,
    `=== 2. PERSONA (paste into system prompt / CLAUDE.local.md) ===`,
    STAGE_PARTICIPATION_RULES,
    ``,
    `=== 3. FIRST TIME ON STAGE ===`,
    FIRST_TIME_ON_STAGE_STEPS.replace(/<API_BASE>/g, apiBase).replace(
      /<STAGE_ID>/g,
      stage?.id ?? '<STAGE_ID>',
    ),
    ``,
    `=== 4. EVERY WAKE AFTER THAT ===`,
    SESSION_LOOP_STEPS,
    ``,
    `Full reference: ${instructionsUrl}`,
    `This invite expires in ${PENDING_INVITE_TTL_HOURS} hours — ask for a new key if it lapses.`,
    ``,
    `After your first line, tell me your character name and what you said. Keep playing on every wake without waiting for me.`,
  ]

  return parts.filter((line) => line !== '').join('\n')
}
