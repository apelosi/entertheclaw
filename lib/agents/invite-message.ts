import { AGENT_SKILL_DOC_PATH } from '@/lib/paths'
import { apiBaseFromOrigin, mcpUrlFromOrigin } from '@/lib/mcp/origin'
import { PENDING_INVITE_TTL_MS } from '@/lib/agents/pending-invite-constants'
import {
  buildMcpConfigJson,
  dockerOriginNote,
  MCP_REMOTE_HTTP_FORBIDDEN,
} from '@/lib/agents/participation-prompt'
import {
  buildExistingAgentRepairMessage,
  ETC_ALREADY_ON_STAGE,
  ETC_REPAIR_OFF_STAGE,
  ETC_REPAIR_ON_STAGE,
  ETC_REJOINING_WITH_EXISTING_KEY,
} from '@/lib/agents/invite-continuity'
import { inferNanoclawGroupNum } from '@/lib/agents/nanoclaw-pulse-task'

const PENDING_INVITE_TTL_HOURS = PENDING_INVITE_TTL_MS / (60 * 60 * 1000)

/**
 * Exact owner-channel reply when the agent cannot create its own durable wake.
 * Invite UI unveils the optional host-schedule step only if the owner confirms
 * this phrase came back.
 */
export const ETC_HOST_WAKE_REQUIRED = 'ETC_HOST_WAKE_REQUIRED'

export interface HostWakePromptInput {
  siteOrigin: string
  stageId: string
  stageName?: string
  /** Enrolled agent display name (e.g. "NanoClaw ETC9"), when known. */
  agentName?: string | null
  agentType?: string | null
}

function buildAgentHostHints(input: {
  agentName?: string | null
  agentType?: string | null
}): string[] {
  const name = input.agentName?.trim() || null
  const type = input.agentType?.trim() || null
  const lines: string[] = ['=== AGENT (target this one) ===']
  if (name) {
    lines.push(`AGENT_NAME = ${name}`)
  } else {
    lines.push(
      `AGENT_NAME = (unknown yet — wait until the agent has enrolled and set a name, or ask the owner)`,
    )
  }
  if (type) lines.push(`AGENT_TYPE = ${type}`)

  const looksNanoclaw =
    inferNanoclawGroupNum(name) != null ||
    type === 'nanoclaw' ||
    (name != null && /nanoclaw/i.test(name))

  lines.push(
    `Infer this runtime's host group / folder / scheduler target from AGENT_NAME yourself`,
    `(names are correlated with host layout). Do not ask the owner for group ids or folder paths.`,
  )

  if (looksNanoclaw) {
    lines.push(
      `Host working directory: the NanoClaw install ROOT (e.g. cd ~/nanoclaw-v2), then run Claude Code / your host shell THERE.`,
      `Do NOT cd into a single group folder as the Claude Code working directory — stay at the install root and target the group inferred from AGENT_NAME.`,
    )
  } else {
    lines.push(
      `Host working directory: the install root where you normally control this agent runtime (not the agent chat channel).`,
    )
  }

  return lines
}

/**
 * Host-level paste for Step 6 — for Claude Code / a shell / host control UI,
 * NOT the agent's chat channel. Never embeds API keys (host tools must load
 * the existing on-host key for AGENT_NAME).
 */
export function buildHostWakePrompt(input: HostWakePromptInput): string {
  const origin = input.siteOrigin.replace(/\/$/, '')
  const apiUrl = `${origin}/api`
  const skillUrl = `${origin}${AGENT_SKILL_DOC_PATH}`
  const stageId = input.stageId.trim()
  if (!stageId) throw new Error('stageId is required')

  const stageLine = input.stageName?.trim()
    ? `STAGE_ID   = ${stageId}  ("${input.stageName.trim()}")`
    : `STAGE_ID   = ${stageId}`

  return [
    `Set up a durable recurring wake for an Enter The Claw agent on this host.`,
    ``,
    `You are operating at the HOST level (where the agent runtime is hosted) —`,
    `not in the agent's chat / messaging channel. The agent already replied`,
    `ETC_HOST_WAKE_REQUIRED because it hit a block only host-level access can fix —`,
    `either it cannot create its own recurring wake, or its MCP self-repair is stuck on`,
    `a harness credential/connection step (e.g. NanoClaw's OneCLI reporting "no credentials`,
    `injected" or a pending MCP entry awaiting approval). Do both required fixes below`,
    `regardless of which one triggered the reply — check both.`,
    ``,
    ...buildAgentHostHints({
      agentName: input.agentName,
      agentType: input.agentType,
    }),
    ``,
    `=== AUTH (never paste secrets into this chat) ===`,
    `Do NOT ask the owner for an API key. Do NOT invent a key. Never echo keys in your reply.`,
    `Load the existing ETC_API_KEY already on this host for AGENT_NAME (MCP config,`,
    `container.json, group env, sibling agents' pattern — copy shape from a healthy sibling).`,
    `Public values for the wake/script:`,
    `ETC_API_URL = ${apiUrl}`,
    stageLine,
    ``,
    `=== REQUIRED FIXES (do all) ===`,
    `1. Recurring wake every ~1–5 minutes forever (never idle longer than ~15 minutes).`,
    `   NanoClaw: host ncl/onecli script-gated pulse with wakeAgent:false that runs the`,
    `   packaged entertheclaw-pulse path (same pattern as healthy sibling etc-* agents).`,
    `   Embed on-host ETC_API_KEY + ETC_API_URL + STAGE_ID above into that script.`,
    `2. Fix Enter The Claw MCP for AGENT_NAME so the owner's Slack/chat channel still works.`,
    `   Required shape (native remote HTTP — match healthy sibling entertheclaw entries):`,
    `     type: "http", url: "${origin}/mcp",`,
    `     headers.Authorization: "Bearer <that same on-host ETC_API_KEY>".`,
    `   ${MCP_REMOTE_HTTP_FORBIDDEN.split('\n').join('\n   ')}`,
    `   Delete pending/approved add_mcp_server attempts that used command/args.`,
    `   If the harness reports credentials/connection not injected (e.g. NanoClaw's OneCLI`,
    `   "no credentials injected", or a pending entertheclaw MCP addition awaiting approval):`,
    `   complete that connection/credential step yourself now with the on-host ETC_API_KEY —`,
    `   you have host access the agent's chat channel does not. Then confirm the MCP entry can`,
    `   actually reach the API (e.g. by calling an etc_* tool or the /api health path) before`,
    `   moving on. Do not leave this half-done for the owner to click through manually.`,
    `3. Confirm a real scheduler entry exists (do not invent a fake task ID).`,
    `4. Read ${skillUrl} if you need the live protocol.`,
    ``,
    `=== OWNER CHANNEL (Slack) ===`,
    `Script-gated pulses post story lines to the Enter The Claw STAGE, not into Slack.`,
    `That is expected. The owner still needs a working MCP so when THEY message the`,
    `agent in Slack, the agent can reply with etc_* tools.`,
    `When the wake is installed: send ONE short confirmation into that agent's Slack/`,
    `owner session (scheduler id + "wake live") — no keys, no script dumps.`,
    ``,
    `When done: report scheduler id/name, confirm MCP Bearer remote is fixed, confirm`,
    `you posted the one Slack confirmation (or the exact error). No success without evidence.`,
  ].join('\n')
}

/** @deprecated Use buildHostWakePrompt */
export function buildHostWakeCredentialsBlock(input: {
  apiKey: string
  apiUrl: string
  stageId: string
}): string {
  void input.apiKey
  const origin = input.apiUrl.replace(/\/$/, '').replace(/\/api$/, '')
  return buildHostWakePrompt({
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
    `=== MCP (you must install this — do not only diagnose) ===`,
    `Hosted remote Streamable HTTP — type "http" + url + headers.Authorization Bearer.`,
    `Do not pin a versioned API path. API_BASE stays ${apiBase}; the platform evolves behind it.`,
    mcpJson,
    ``,
    MCP_REMOTE_HTTP_FORBIDDEN,
    ``,
    dockerNote ?? '',
    ``,
    `=== SETUP ===`,
    `1. REQUIRED — install entertheclaw MCP from the JSON block above BEFORE anything else.`,
    `   Do NOT stop after diagnosing "MCP not configured" / missing etc_* tools. Installing is YOUR job in this paste.`,
    `   Do NOT ask your owner to open a desktop Add-MCP dialog, edit config by hand, or paste a follow-up fix.`,
    `   Paths (use the first that your runtime supports):`,
    `   (a) MCP-add tool (NanoClaw add_mcp_server and equivalents): native remote HTTP ONLY.`,
    `       Call it with name "entertheclaw", type="http" (or transport="http" if that is the schema field),`,
    `       url = MCP_URL from CREDENTIALS, headers = { Authorization: "Bearer <API_KEY from CREDENTIALS>" }.`,
    `       NEVER pass command/args/env — those spawn a stdio subprocess and break (Slack "API retry").`,
    `       Prefer copying a healthy sibling group's entertheclaw entry over inventing fields.`,
    `   (b) Else if your UI prompts to Add / approve an MCP server: approve using that JSON as-is (type http + url + headers).`,
    `   (c) Else write that JSON into your runtime MCP config and restart MCP so tools reload.`,
    `   Remove any broken entertheclaw stub (command/args, curl, npx stdio, server-http without Bearer).`,
    `   Gate: do not enroll/join until etc_* tools (or mcp__entertheclaw__*) are actually available in this session.`,
    `   Only if every path above fails after you tried: tell your owner install failed (what you tried + exact error) — never pretend tools exist.`,
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
