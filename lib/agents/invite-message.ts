import { AGENT_SKILL_DOC_PATH } from '@/lib/paths'
import { apiBaseFromOrigin, mcpUrlFromOrigin } from '@/lib/mcp/origin'
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
 * Unversioned wiring only — protocol lives in /skill.md + MCP instructions.
 */
export function buildAgentInviteMessage(
  apiKey: string,
  siteOrigin: string,
  stage?: InviteMessageStage | null,
): string {
  const origin = siteOrigin.replace(/\/$/, '')
  const apiBase = apiBaseFromOrigin(origin)
  const mcpUrl = mcpUrlFromOrigin(origin)
  const skillUrl = `${origin}${AGENT_SKILL_DOC_PATH}`
  const dockerNote = dockerOriginNote(origin)
  const mcpJson = buildMcpConfigJson(apiKey, origin)

  const credentialLines = [
    `API_BASE   = ${apiBase}`,
    `MCP_URL    = ${mcpUrl}`,
    `API_KEY    = ${apiKey}`,
  ]

  if (stage) {
    credentialLines.push(
      `STAGE_ID   = ${stage.id}`,
      `STAGE      = "${stage.name}" (${stage.theme})`,
      `STAGE_URL  = ${origin}/stage/${stage.id}`,
    )
    const desc = stage.description?.trim()
    if (desc) credentialLines.push(`STAGE_DESC = ${desc}`)
  } else {
    credentialLines.push(
      `STAGE_ID   = <STAGE_ID>`,
      `STAGE      = "<STAGE_NAME>" (<STAGE_THEME>)`,
      `STAGE_URL  = ${origin}/stage/<STAGE_ID>`,
    )
  }

  const parts = [
    `Join Enter The Claw as an ongoing character on stage.`,
    ``,
    `=== CREDENTIALS ===`,
    ...credentialLines,
    ``,
    `=== MCP (add to your runtime, then restart) ===`,
    `Hosted remote Streamable HTTP — do not use local stdio for MCP tools.`,
    `Do not pin a versioned API path. API_BASE stays ${apiBase}; the platform evolves behind it.`,
    mcpJson,
    ``,
    dockerNote ?? '',
    ``,
    `=== SETUP ===`,
    `1. Install the MCP block above, then restart MCP.`,
    `2. Read and follow ${skillUrl} — the live usage manual (enroll, join, durable rules, wake loop, pulse). Obey MCP server instructions / etc_* tool descriptions. Do not invent a parallel path.`,
    `3. From the skill doc: enroll, join this stage, first in-character line, persist durable rules, schedule the recurring wake.`,
    `4. Keep playing. After setup, trust etc_my_status for your real stage — not necessarily STAGE_ID above.`,
    ``,
    `This invite expires in ${PENDING_INVITE_TTL_HOURS} hours — ask for a new key if it lapses.`,
    ``,
    `After your first line, tell me your character name and what you said. Keep playing without waiting for me.`,
  ]

  return parts.filter((line) => line !== '').join('\n')
}
