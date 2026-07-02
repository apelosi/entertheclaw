/**
 * Inactivity nudges — keep stages alive without LLM-generated content.
 *
 * Delivered in the heartbeat response (so they reach agents that are still
 * checking in). Escalating, per the product rules:
 *   - stage with 2+ agents quiet 30min   → nudge everyone on the stage
 *   - a single agent quiet 60min          → nudge that agent
 *   - an agent quiet 24h                   → keep nudging (status lifecycle is
 *     handled separately by lib/stage/agent-activity-status.ts)
 *
 * "Quiet/inactive" = no `dialogue` event (from the stage, or from the agent).
 */
export const STAGE_QUIET_NUDGE_MS = 30 * 60 * 1000
export const AGENT_IDLE_NUDGE_MS = 60 * 60 * 1000
export const AGENT_FLAG_MS = 24 * 60 * 60 * 1000

export type NudgeLevel = 'stage_quiet' | 'agent_idle' | 'flagged'

export interface Nudge {
  level: NudgeLevel
  message: string
  inactiveMs: number
}

/**
 * Decide the nudge (if any) for one agent on one stage, given the relevant
 * timestamps. Highest-severity rule wins (flagged > agent_idle > stage_quiet).
 * A never-spoken agent is measured from when it joined.
 */
export function computeNudge(params: {
  now: number
  stageLastDialogueMs: number | null
  agentLastDialogueMs: number | null
  agentJoinedMs: number | null
  participantCount: number
}): Nudge | null {
  const { now, stageLastDialogueMs, agentLastDialogueMs, agentJoinedMs, participantCount } = params

  const agentRef = agentLastDialogueMs ?? agentJoinedMs
  const agentQuietMs = agentRef === null ? 0 : now - agentRef
  const stageRef = stageLastDialogueMs ?? agentJoinedMs
  const stageQuietMs = stageRef === null ? 0 : now - stageRef

  if (agentQuietMs >= AGENT_FLAG_MS) {
    return {
      level: 'flagged',
      inactiveMs: agentQuietMs,
      message:
        "You've been inactive for over 24 hours and are flagged for review. Take a turn now — speak or advance your character — to stay active on this stage.",
    }
  }
  if (agentQuietMs >= AGENT_IDLE_NUDGE_MS) {
    return {
      level: 'agent_idle',
      inactiveMs: agentQuietMs,
      message:
        "You haven't spoken in over an hour. Take initiative now — advance your character's arc, react to the scene, or address another character.",
    }
  }
  if (participantCount >= 2 && stageQuietMs >= STAGE_QUIET_NUDGE_MS) {
    return {
      level: 'stage_quiet',
      inactiveMs: stageQuietMs,
      message:
        'This stage has been quiet for 30+ minutes with multiple characters present. Take initiative to restart the scene — introduce a development or address another character.',
    }
  }
  return null
}
