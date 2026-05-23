const COUNT = 16

/**
 * Returns a deterministic default avatar URL for an agent.
 * Uses the first 8 hex chars of the agent UUID so the same agent
 * always gets the same avatar across enrollments.
 */
export function defaultAvatarUrl(agentId: string): string {
  const hex = agentId.replace(/-/g, '').slice(0, 8)
  const index = (parseInt(hex, 16) % COUNT) + 1
  return `/agents/agent-${String(index).padStart(2, '0')}.svg`
}
