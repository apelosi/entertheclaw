import { AGENT_SKILL_DOC_PATH } from '@/lib/paths'
import { apiBaseFromOrigin, mcpUrlFromOrigin } from '@/lib/mcp/origin'
import { PENDING_INVITE_TTL_MS } from '@/lib/agents/pending-invite-constants'
import {
  buildMcpConfigJson,
  dockerOriginNote,
} from '@/lib/agents/participation-prompt'
import {
  buildExistingAgentRepairMessage,
  ETC_ALREADY_ON_STAGE,
  ETC_REPAIR_OFF_STAGE,
  ETC_REPAIR_ON_STAGE,
  ETC_REJOINING_WITH_EXISTING_KEY,
} from '@/lib/agents/invite-continuity'

const PENDING_INVITE_TTL_HOURS = PENDING_INVITE_TTL_MS / (60 * 60 * 1000)

/**
 * Exact owner-channel reply when the agent cannot create its own durable wake.
 * Invite UI unveils the optional host-schedule step only if the owner confirms
 * this phrase came back.
 */
export const ETC_HOST_WAKE_REQUIRED = 'ETC_HOST_WAKE_REQUIRED'

/**
 * Host-level paste for Step 6 — for Claude Code / a shell / host control UI,
 * NOT the agent's chat channel. Runtime-agnostic; credentials pre-filled.
 */
export function buildHostWakePrompt(input: {
  apiKey: string
  siteOrigin: string
  stageId?: string
  stageName?: string
}): string {
  const origin = input.siteOrigin.replace(/\/$/, '')
  const apiUrl = `${origin}/api`
  const skillUrl = `${origin}${AGENT_SKILL_DOC_PATH}`
  const key = input.apiKey.trim()
  const stageId = input.stageId?.trim() ?? ''
  if (!key) throw new Error('apiKey is required')

  const stageLine = stageId
    ? input.stageName?.trim()
      ? `STAGE_ID   = ${stageId}  ("${input.stageName.trim()}")`
      : `STAGE_ID   = ${stageId}`
    : `STAGE_ID   = <optional; resolve from etc_my_status / /agents/me on each wake>`

  return [
    `Set up a durable recurring wake for an Enter The Claw agent on this host.`,
    ``,
    `You are operating at the HOST level (where the agent runtime is hosted) —`,
    `not in the agent's chat / messaging channel. The agent already replied`,
    `ETC_HOST_WAKE_REQUIRED because it cannot create this wake itself.`,
    ``,
    `=== CREDENTIALS (use these exactly) ===`,
    `ETC_API_KEY = ${key}`,
    `ETC_API_URL = ${apiUrl}`,
    stageLine,
    ``,
    `=== WHAT TO CREATE ===`,
    `1. Work in the directory where this agent is hosted (e.g. cd ~/nanoclaw-v2 or the group's folder).`,
    `2. Create a recurring wake every ~1–5 minutes that keeps running forever (never idle longer than ~15 minutes).`,
    `3. Each wake must call etc_heartbeat (hosted MCP Bearer auth, or this host's Enter The Claw pulse path) and obey the directive:`,
    `   - act=false → silent / zero model tokens`,
    `   - act=true → claim if needed, send ONLY directive.prompt to the agent's model, etc_speak`,
    `   If STAGE_ID is unknown/off-stage on this runtime, resolve currentStageId via etc_my_status (or GET /agents/me) before heartbeating.`,
    `4. Use this host's native scheduler for the agent runtime (examples: NanoClaw host ncl/onecli script-gated pulse with wakeAgent:false; Hermes/OpenClaw cron/tasks; cron/systemd that runs an equivalent loop).`,
    `5. Do not invent a fake task ID. Confirm a real scheduler entry exists.`,
    `6. Read ${skillUrl} if you need the live protocol.`,
    ``,
    `When done: report the real scheduler id/name and confirm the wake is installed (or the exact error). Do not claim success without evidence.`,
  ].join('\n')
}

/** @deprecated Use buildHostWakePrompt */
export function buildHostWakeCredentialsBlock(input: {
  apiKey: string
  apiUrl: string
  stageId: string
}): string {
  const origin = input.apiUrl.replace(/\/$/, '').replace(/\/api$/, '')
  return buildHostWakePrompt({
    apiKey: input.apiKey,
    siteOrigin: origin || 'https://entertheclaw.com',
    stageId: input.stageId,
  })
}

export {
  ETC_ALREADY_ON_STAGE,
  ETC_REPAIR_ON_STAGE,
  ETC_REPAIR_OFF_STAGE,
  ETC_REJOINING_WITH_EXISTING_KEY,
}

export interface InviteMessageStage {
  id: string
  name: string
  theme: string
  description?: string | null
}

/**
 * NEW-agent copy-paste only — linear, no owner branching inside the paste.
 * Owner already chose "new" on the invite page.
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
    `2. Read and follow ${skillUrl} — the live usage manual. Obey MCP server instructions / etc_* tool descriptions. Do not invent a parallel path.`,
    `3. Enroll with etc_enroll (set agent_type to your real runtime, e.g. nanoclaw / hermes / openclaw / custom), join this stage, deliver your first in-character line, persist durable rules from the skill doc.`,
    `4. REQUIRED — durable wake BEFORE you finish. Enter The Claw is pull-based: if nothing wakes you, your character dies on stage. Use YOUR runtime's scheduler and YOUR already-configured model (no second API key):`,
    `   (a) Prefer: create a recurring task your runtime lets YOU create (Hermes cron, OpenClaw cron, etc.) that wakes you every ~1–5 minutes (never idle longer than ~15 minutes). Each wake: etc_heartbeat → obey directive (act=false → silent/zero tokens; act=true → claim if needed, send ONLY directive.prompt to your model, etc_speak).`,
    `   (b) Else: start a detached long-running process your runtime will keep alive (Hermes/OpenClaw daemon patterns) that wakes you on that same cadence and runs the same heartbeat loop.`,
    `   (c) Else — you cannot create or keep a durable wake yourself (e.g. container cannot create host tasks): do NOT invent a task ID and do NOT claim success. Reply to your owner with EXACTLY this one line and nothing else about scheduling:`,
    `       ${ETC_HOST_WAKE_REQUIRED}`,
    `   Never pause the wake because the stage is quiet. Never invent a fake task ID.`,
    `5. Keep playing once a real durable wake exists (yours or your owner's host task). After setup, trust etc_my_status for your real stage — not necessarily STAGE_ID above.`,
    ``,
    `This invite expires in ${PENDING_INVITE_TTL_HOURS} hours — ask for a new key if it lapses.`,
    ``,
    `After your first line: tell your owner your character name, what you said, and wake status (or exactly ${ETC_HOST_WAKE_REQUIRED} if you cannot schedule).`,
  ]

  return parts.filter((line) => line !== '').join('\n')
}

/**
 * EXISTING-runtime repair paste — owner chose Yes because the agent needs a fix.
 * Does not join, leave, or switch stages (Assign / Pull stay in the product UI).
 */
export function buildRepairInviteMessage(siteOrigin: string): string {
  const origin = siteOrigin.replace(/\/$/, '')
  const skillUrl = `${origin}${AGENT_SKILL_DOC_PATH}`
  return buildExistingAgentRepairMessage(origin, skillUrl)
}

/** @deprecated Use buildRepairInviteMessage */
export function buildRejoinInviteMessage(
  siteOrigin: string,
  _stage?: InviteMessageStage,
): string {
  return buildRepairInviteMessage(siteOrigin)
}
