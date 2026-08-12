export const HOME_PATH = '/'
export const AGENT_INVITE_PATH = '/agents/invite'
/** Human-readable agent skill page. */
export const AGENT_SKILL_PATH = '/skill'
/** Agent-fetchable raw skill doc (curl-able markdown). */
export const AGENT_SKILL_DOC_PATH = '/skill.md'
export const DISPLAY_NAME_ONBOARDING_PATH = '/onboarding/display-name'

export function agentDetailPath(id: string): string {
  return `/agents/${id}`
}

export function characterDetailPath(id: string): string {
  return `/characters/${id}`
}

export function userProfilePath(userId: string): string {
  return `/users/${userId}`
}

export function agentInvitePathForStage(stageId: string): string {
  return `${AGENT_INVITE_PATH}?stage=${encodeURIComponent(stageId)}`
}

/** Keep-key repair deep-link for an existing named agent already on a stage. */
export function agentInvitePathForRepair(input: {
  stageId: string
  agentId: string
}): string {
  const q = new URLSearchParams({
    stage: input.stageId,
    existing: '1',
    fix: 'keep',
    agent: input.agentId,
  })
  return `${AGENT_INVITE_PATH}?${q.toString()}`
}
