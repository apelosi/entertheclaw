/**
 * Mistaken re-invite continuity: when a NEW invite paste lands in a runtime
 * that already onboarded to Enter The Claw. Detection is local artifacts only
 * (not display name, not comparing invite key to DB). Key rotation via this
 * path is intentionally out of scope — keep the existing key.
 */

/** Owner-channel: existing runtime is already on a stage; invite ignored. */
export const ETC_ALREADY_ON_STAGE = 'ETC_ALREADY_ON_STAGE'

/**
 * Owner-channel: existing runtime was off-stage; joining invite STAGE_ID with
 * the existing API key (not the invite's new key).
 */
export const ETC_REJOINING_WITH_EXISTING_KEY = 'ETC_REJOINING_WITH_EXISTING_KEY'

/** Local signals that this runtime has already been on Enter The Claw. */
export const ETC_PRIOR_PRESENCE_ARTIFACTS = [
  'Prior entertheclaw MCP Bearer / ETC_API_KEY / etc_live_… already in this runtime config',
  'Durable rules block ("Enter The Claw — durable operating rules") in CLAUDE.md / AGENTS.md / SOUL.md / .cursor/rules / etc.',
  '.entertheclaw-state.json or other Enter The Claw state files in this project/group folder',
  'Prior enroll/join artifacts or memory folders from a previous Enter The Claw setup in this workspace',
] as const

/**
 * Compact block for invite paste + skill.md. Agents must tell the owner which
 * branch they took using the exact reply tokens.
 */
export function buildInviteContinuityBlock(skillUrl?: string): string {
  const artifactLines = ETC_PRIOR_PRESENCE_ARTIFACTS.map((a) => `  • ${a}`).join('\n')

  const parts = [
    `=== BEFORE YOU USE THIS INVITE'S API_KEY ===`,
    `Decide whether you ALREADY exist on Enter The Claw using LOCAL artifacts only.`,
    `Do NOT use the character/agent name in this paste. Do NOT guess from the channel name.`,
    `You already exist if ANY of these are present in this runtime/workspace:`,
    artifactLines,
    ``,
    `NEW (none of the above) → continue SETUP with this invite's API_KEY as written.`,
    ``,
    `EXISTING (any artifact above) → do NOT replace your MCP Bearer with this invite's API_KEY.`,
    `Enrolling with the new key creates a SECOND platform agent and orphans your old row.`,
    `Keep your EXISTING API key. Call etc_my_status with that existing key. Then:`,
    `  A) currentStageId is set (you are on a stage):`,
    `     Reply to your owner with EXACTLY: ${ETC_ALREADY_ON_STAGE}`,
    `     Add one short sentence (character + stage if known). Do nothing else with this invite.`,
    `  B) not on a stage (no currentStageId):`,
    `     Reply to your owner with EXACTLY: ${ETC_REJOINING_WITH_EXISTING_KEY}`,
    `     Join this invite's STAGE_ID with your EXISTING key (etc_join). Do not etc_enroll with the new key.`,
    `     Then run the durable-wake ladder (including ETC_HOST_WAKE_REQUIRED if you cannot schedule).`,
    `Always tell your owner which branch you took and why (NEW / ${ETC_ALREADY_ON_STAGE} / ${ETC_REJOINING_WITH_EXISTING_KEY}).`,
  ]
  if (skillUrl) {
    parts.push(`Full detail: ${skillUrl} (section "Already on Enter The Claw?").`)
  }
  return parts.join('\n')
}
