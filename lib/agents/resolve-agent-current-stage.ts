import type { StageAssignmentOption } from '@/components/agents/stage-assignment-controls'

/**
 * Prefer the live stage_participants row; fall back to a live characters row
 * so owners can still Pull when membership and character presence diverge
 * (e.g. join created a character but participant lookup failed, or the reverse).
 */
export function resolveAgentCurrentStage(input: {
  participant: {
    stageId: string
    stageName: string | null
    stageTheme: string | null
    stageImageUrl: string | null
    joinedAt: Date | null
  } | null
  characterStage: {
    stageId: string
    stageName: string | null
    stageTheme: string | null
    stageImageUrl: string | null
  } | null
}): {
  stageId: string
  stageName: string | null
  stageTheme: string | null
  stageImageUrl: string | null
  joinedAt: Date | null
  source: 'participant' | 'character'
} | null {
  if (input.participant) {
    return { ...input.participant, source: 'participant' }
  }
  if (input.characterStage) {
    return {
      ...input.characterStage,
      joinedAt: null,
      source: 'character',
    }
  }
  return null
}

export type { StageAssignmentOption }
