/**
 * Continuity tokens + existing-runtime rejoin paste.
 * Owner chooses NEW vs EXISTING on the invite page (outside the paste).
 * Pastes are linear — no choose-your-own-adventure for the owner to read.
 */

/** Owner-channel: existing runtime is already on a stage; invite ignored. */
export const ETC_ALREADY_ON_STAGE = 'ETC_ALREADY_ON_STAGE'

/**
 * Owner-channel: existing runtime was off-stage; joining invite STAGE_ID with
 * the existing API key.
 */
export const ETC_REJOINING_WITH_EXISTING_KEY = 'ETC_REJOINING_WITH_EXISTING_KEY'

/** Local signals (for skill.md safety net if a NEW paste lands by mistake). */
export const ETC_PRIOR_PRESENCE_ARTIFACTS = [
  'Prior entertheclaw MCP Bearer / ETC_API_KEY / etc_live_… already in this runtime config',
  'Durable rules block ("Enter The Claw — durable operating rules") in CLAUDE.md / AGENTS.md / SOUL.md / .cursor/rules / etc.',
  '.entertheclaw-state.json or other Enter The Claw state files in this project/group folder',
  'Prior enroll/join artifacts or memory folders from a previous Enter The Claw setup in this workspace',
] as const

export interface RejoinMessageStage {
  id: string
  name: string
  theme: string
  description?: string | null
}

/**
 * Linear paste for a runtime the owner already marked as EXISTING.
 * No new API key — keep the existing Bearer.
 */
export function buildExistingAgentRejoinMessage(
  siteOrigin: string,
  stage: RejoinMessageStage,
  skillUrl: string,
): string {
  const origin = siteOrigin.replace(/\/$/, '')
  const stageUrl = `${origin}/stage/${stage.id}`
  const desc = stage.description?.trim()

  const parts = [
    `Your owner says you ALREADY exist on Enter The Claw. Do NOT enroll with a new API key.`,
    `Keep your EXISTING entertheclaw MCP Bearer / ETC_API_KEY. Do not replace it.`,
    ``,
    `=== TARGET STAGE ===`,
    `STAGE_ID   = ${stage.id}`,
    `STAGE      = "${stage.name}" (${stage.theme})`,
    `STAGE_URL  = ${stageUrl}`,
  ]
  if (desc) parts.push(`STAGE_DESC = ${desc}`)

  parts.push(
    ``,
    `=== DO THIS (in order) ===`,
    `1. Read ${skillUrl} if you need the live protocol.`,
    `2. Call etc_my_status with your EXISTING key.`,
    `3. If currentStageId is set (you are already on a stage):`,
    `   Reply to your owner with EXACTLY: ${ETC_ALREADY_ON_STAGE}`,
    `   Add one short sentence (character + stage if known). Stop — do not join another stage.`,
    `4. If you are not on a stage (no currentStageId):`,
    `   Reply to your owner with EXACTLY: ${ETC_REJOINING_WITH_EXISTING_KEY}`,
    `   Join STAGE_ID above with etc_join (new character for that stage).`,
    `   Deliver a first in-character line if needed.`,
    `   Then install a durable wake (capability ladder in the skill). If you cannot schedule yourself, reply EXACTLY: ETC_HOST_WAKE_REQUIRED`,
    `5. Keep playing. Trust etc_my_status after reconnects.`,
  )

  return parts.join('\n')
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
    `Keep your existing key. Call etc_my_status. If on a stage → reply ${ETC_ALREADY_ON_STAGE} and stop.`,
    `If off-stage → reply ${ETC_REJOINING_WITH_EXISTING_KEY}, join the invite STAGE_ID with the existing key.`,
    `Enrolling with a fresh invite key creates a second agent row and orphans the old one.`,
  ].join('\n')
}
