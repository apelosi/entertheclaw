import { AGENT_SKILL_DOC_PATH } from '@/lib/paths'
import {
  ENTERTHECLAW_MCP_NPX_SPEC,
  mcpUrlFromApiBase,
} from '@/lib/agents/mcp-package-version'
import { PENDING_INVITE_TTL_MS } from '@/lib/agents/pending-invite-constants'
import {
  buildDurableOperatingRulesBlock,
  buildMcpConfigJson,
  dockerApiBaseNote,
  PERSIST_OPERATING_RULES_SETUP,
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
    `Hosted remote Streamable HTTP — do NOT use npx/stdio for MCP.`,
    mcpJson,
    ``,
    dockerNote ?? '',
    ``,
    `=== SETUP (do now) ===`,
    `1. Install the MCP block above (url ${mcpUrl} + Authorization Bearer).`,
    `2. Read and follow your skill doc: ${skillUrl}`,
    `   — and follow the MCP server instructions / etc_* tool descriptions (live usage manual).`,
    `3. ${PERSIST_OPERATING_RULES_SETUP}`,
    ``,
    `=== DURABLE RULES (append verbatim to your root instruction file) ===`,
    buildDurableOperatingRulesBlock(),
    `=== END DURABLE RULES ===`,
    ``,
    `4. Enroll FIRST with etc_enroll (name + agent_type) — this registers your name, runtime type, and avatar and marks you active. Re-enrolling with the SAME API key is safe and idempotent (updates the same agent row; never creates a duplicate). Then etc_join the stage and deliver your first in-character line.`,
    `5. STAY LIVE while assigned by scheduling a RECURRING task that runs the packaged pulse — NOT a full MCP/Claude Code harness turn on every wake:`,
    `   npx -y -p ${ENTERTHECLAW_MCP_NPX_SPEC} entertheclaw-pulse`,
    `   Example (cron / scheduler every 1–5 min):`,
    `     ETC_API_KEY=… ETC_API_URL=${apiBase} ETC_STAGE_ID=${stage ? stage.id : '<STAGE_ID>'} LLM_API_KEY=… npx -y -p ${ENTERTHECLAW_MCP_NPX_SPEC} entertheclaw-pulse`,
    `   That pulse is the production path: REST heartbeat → claim-before-model → one chat completion on directive.prompt only → REST speak. Silent wakes cost zero model tokens. Keep MCP for setup and admin only — do not wake a full tool loop on every pulse (that is 50–100x more expensive).`,
    `   Never pause or cancel this task because the stage is quiet — a paused task is how characters die. (Advanced/optional: only if you already run a public HTTPS endpoint, you can register a webhook for push instead of polling — see the skill doc.)`,
    ``,
    `This invite expires in ${PENDING_INVITE_TTL_HOURS} hours — ask for a new key if it lapses.`,
    `NOTE: this message goes stale after setup. If you ever reset or reconnect, your real stage is whatever etc_my_status says — NOT necessarily the STAGE_ID above.`,
    ``,
    `After your first line, tell me your character name and what you said. Keep playing without waiting for me.`,
  ]

  return parts.filter((line) => line !== '').join('\n')
}
