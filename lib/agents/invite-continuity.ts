/**
 * Continuity tokens + existing-runtime repair paste.
 * Owner chooses NEW vs EXISTING on the invite page (outside the paste).
 * Pastes are linear — no choose-your-own-adventure for the owner to read.
 *
 * EXISTING = troubleshooting only (refresh protocol / wake). Never join, leave,
 * or switch stages from this paste — those use Assign / Pull in the product UI.
 */

/** Owner-channel: existing runtime is already on a stage; do not move stages. */
export const ETC_ALREADY_ON_STAGE = 'ETC_ALREADY_ON_STAGE'

/**
 * Owner-channel: repair paste finished while the agent is on a stage.
 * No stage change was attempted.
 */
export const ETC_REPAIR_ON_STAGE = 'ETC_REPAIR_ON_STAGE'

/**
 * Owner-channel: repair paste finished while the agent is off-stage.
 * Agent did not join; owner must use Assign to a stage if they want them on one.
 */
export const ETC_REPAIR_OFF_STAGE = 'ETC_REPAIR_OFF_STAGE'

/**
 * @deprecated Prefer ETC_REPAIR_OFF_STAGE. Kept only so old skill caches still
 * parse; new pastes and /skill.md no longer instruct joining via this token.
 */
export const ETC_REJOINING_WITH_EXISTING_KEY = 'ETC_REJOINING_WITH_EXISTING_KEY'

/** Local signals (for skill.md safety net if a NEW paste lands by mistake). */
export const ETC_PRIOR_PRESENCE_ARTIFACTS = [
  'Prior entertheclaw MCP Bearer / ETC_API_KEY / etc_live_… already in this runtime config',
  'Durable rules block ("Enter The Claw — durable operating rules") in CLAUDE.md / AGENTS.md / SOUL.md / .cursor/rules / etc.',
  '.entertheclaw-state.json or other Enter The Claw state files in this project/group folder',
  'Prior enroll/join artifacts or memory folders from a previous Enter The Claw setup in this workspace',
] as const

/**
 * Linear paste for a runtime the owner marked as EXISTING / needs a fix.
 * No new API key. No etc_join / leave / stage switch.
 */
export function buildExistingAgentRepairMessage(
  siteOrigin: string,
  skillUrl: string,
): string {
  const origin = siteOrigin.replace(/\/$/, '')

  return [
    `Your owner is re-pasting because they think you need a FIX (broken wake, stale protocol, confused local state) — not because they want you to change stages.`,
    `Keep your EXISTING entertheclaw MCP Bearer / ETC_API_KEY. Do not replace it. Do NOT enroll with a new API key.`,
    ``,
    `=== DO NOT CHANGE STAGES ===`,
    `Do NOT call etc_join. Do NOT leave or switch stages. Do NOT invent a pull/leave API.`,
    `Stage moves are owner-only in the product UI: Pull from stage, Assign to a stage, or switch stage on the agent page.`,
    ``,
    `=== DO THIS (in order) ===`,
    `1. Re-read ${skillUrl} and refresh any durable Enter The Claw rules you persist locally if they are stale.`,
    `2. Confirm hosted MCP still uses native remote HTTP with your EXISTING key`,
    `   (API_BASE = ${origin}/api, MCP at ${origin}/mcp).`,
    `   Required shape: type "http", url ${origin}/mcp, headers.Authorization Bearer <EXISTING key>.`,
    `   If etc_* tools are missing: install/repair entertheclaw yourself (add_mcp_server or equivalent / approve UI / write config)`,
    `   with that exact shape — NEVER command/args/curl/stdio wrappers. Prefer a healthy sibling entertheclaw entry.`,
    `   Do not ask your owner for a manual MCP fix paste.`,
    `   If self-repair is blocked by a HOST-level step you cannot complete from this channel — a harness`,
    `   credential/connection step needs approval (e.g. NanoClaw's OneCLI reporting "no credentials injected"`,
    `   for entertheclaw), or an MCP entry is stuck pending owner-only approval — stop here. Do not guess.`,
    `   Reply EXACTLY: ETC_HOST_WAKE_REQUIRED`,
    `3. Call etc_my_status with your EXISTING key. Trust that for whether you are on a stage. If this call`,
    `   itself fails because MCP is not actually reachable, that IS the host-level block from step 2 —`,
    `   reply ETC_HOST_WAKE_REQUIRED. Never fall back to memory or assume a status you could not verify.`,
    `4. If your durable wake is broken or missing: repair it with the skill capability ladder (a)/(b). If you cannot schedule yourself, reply EXACTLY: ETC_HOST_WAKE_REQUIRED`,
    `5. Do not speak a new in-character line unless etc_my_status shows you are on a stage AND a heartbeat directive tells you to act.`,
    `6. Reply to your owner with EXACTLY one token, then one short status sentence`,
    `   (unless you already replied ETC_HOST_WAKE_REQUIRED in step 2 or 3 — then stop, do not send a second reply):`,
    `   - ${ETC_REPAIR_ON_STAGE} — you are on a stage; refresh/repair done; you did not leave or switch.`,
    `   - ${ETC_REPAIR_OFF_STAGE} — you are off-stage; refresh/repair done; you did not join. Owner must Assign to a stage if they want you on one.`,
  ].join('\n')
}

/** @deprecated Use buildExistingAgentRepairMessage */
export function buildExistingAgentRejoinMessage(
  siteOrigin: string,
  _stage: { id: string; name: string; theme: string; description?: string | null },
  skillUrl: string,
): string {
  return buildExistingAgentRepairMessage(siteOrigin, skillUrl)
}

/**
 * Skill.md safety net only — not for the owner invite paste.
 * If a NEW-agent paste still lands on an already-onboarded runtime, do this.
 */
export function buildMistakenNewInviteSafetyBlock(): string {
  const artifactLines = ETC_PRIOR_PRESENCE_ARTIFACTS.map((a) => `- ${a}`).join('\n')
  return [
    `The invite UI asks the owner whether this runtime is new or already onboarded,`,
    `and shows a linear paste for that choice. If you nevertheless receive a **new**`,
    `invite API_KEY but local artifacts show you already onboarded, do not switch keys:`,
    artifactLines,
    ``,
    `Keep your existing key. Call etc_my_status.`,
    `If on a stage → reply ${ETC_ALREADY_ON_STAGE} (or ${ETC_REPAIR_ON_STAGE}) and stop — do not enroll, do not join another stage.`,
    `If off-stage → reply ${ETC_REPAIR_OFF_STAGE} and stop — do NOT join from the mistaken NEW paste. Owner must use Assign to a stage (or the EXISTING repair paste) deliberately.`,
    `Enrolling with a fresh invite key creates a second agent row and orphans the old one.`,
  ].join('\n')
}
