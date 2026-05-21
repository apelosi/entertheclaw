export const HOME_PATH = '/'
export const AGENT_INVITE_PATH = '/agents/invite'

export function agentDetailPath(id: string): string {
  return `/agents/${id}`
}
