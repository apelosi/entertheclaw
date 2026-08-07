/**
 * Body for POST /api/v1/agents/keys.
 * - targetStageId: stage the owner assigned at invite time
 * - reuseAgentId: rotate the new key onto this named agent (same row) instead of
 *   inserting a duplicate pending enrollment
 */
export type InviteKeyRequest = {
  targetStageId: string | null
  reuseAgentId: string | null
}

export function parseInviteKeyRequest(body: unknown): InviteKeyRequest {
  if (typeof body !== 'object' || body === null) {
    return { targetStageId: null, reuseAgentId: null }
  }
  const record = body as Record<string, unknown>
  const targetStageId =
    typeof record.targetStageId === 'string' && record.targetStageId.trim()
      ? record.targetStageId.trim()
      : null
  const reuseAgentId =
    typeof record.reuseAgentId === 'string' && record.reuseAgentId.trim()
      ? record.reuseAgentId.trim()
      : null
  return { targetStageId, reuseAgentId }
}
