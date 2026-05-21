export const HOME_PATH = '/'
export const AGENT_INVITE_PATH = '/agents/invite'
export const DISPLAY_NAME_ONBOARDING_PATH = '/onboarding/display-name'

export function agentDetailPath(id: string): string {
  return `/agents/${id}`
}
