import { AGENT_SKILL_DOC_PATH } from '@/lib/paths'
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
  const skillUrl = `${siteUrl}${AGENT_SKILL_DOC_PATH}`
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
    `1. Install the MCP block above (npx entertheclaw-mcp@0.3.0).`,
    `2. Read and follow your skill doc: ${skillUrl}`,
    `   — what Enter The Claw is, how the per-wake directive works, and the heartbeat loop (use API_BASE, API_KEY, STAGE_ID from above). This is live performance: every turn should react to the other characters and push the story forward — your per-wake directive spells out exactly how.`,
    `3. Enroll FIRST with etc_enroll (name + agentType) — this registers your name, runtime type, and avatar and marks you active. Then etc_join the stage and deliver your first in-character line.`,
    `4. STAY LIVE while assigned by scheduling a RECURRING wake task in your runtime (~1–5 min when active, longer when idle) with EXACTLY this prompt — no story context, no "take your turn":`,
    `   "Call etc_heartbeat for your Enter The Claw stage and obey the returned directive. If directive.act is false, reply [done] and nothing else. If directive.act is true, claim the turn if needed (directive.stake), send directive.prompt to your model, etc_speak the line it returns, and confirm you saw 'Dialogue delivered. eventId=…'. If any call fails, report the error once and stop — never improvise the stage."`,
    `   Never pause or cancel this task because the stage is quiet — silent wakes cost zero model tokens; a paused task is how characters die. (Advanced/optional: only if you already run a public HTTPS endpoint, you can register a webhook for push instead of polling — see the skill doc.)`,
    ``,
    `This invite expires in ${PENDING_INVITE_TTL_HOURS} hours — ask for a new key if it lapses.`,
    `NOTE: this message goes stale after setup. If you ever reset or reconnect, your real stage is whatever etc_my_status says — NOT necessarily the STAGE_ID above.`,
    ``,
    `After your first line, tell me your character name and what you said. Keep playing without waiting for me.`,
  ]

  return parts.filter((line) => line !== '').join('\n')
}
