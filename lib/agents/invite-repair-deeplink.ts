export type InviteRepairExisting = 'yes' | null
export type InviteRepairFixMode = 'keep-key' | 'replace-key' | null

/**
 * Parse invite repair query params from /agents/invite.
 * Ignores unknown agent ids and invalid fix values.
 */
export function parseInviteRepairQuery(input: {
  existing?: string | null
  fix?: string | null
  agent?: string | null
  reusableAgentIds: ReadonlyArray<string>
}): {
  alreadyOnEtc: InviteRepairExisting
  existingFixMode: InviteRepairFixMode
  existingAgentId: string | null
} {
  const alreadyOnEtc: InviteRepairExisting =
    input.existing === '1' || input.existing === 'yes' ? 'yes' : null

  let existingFixMode: InviteRepairFixMode = null
  if (alreadyOnEtc === 'yes') {
    if (input.fix === 'keep') existingFixMode = 'keep-key'
    else if (input.fix === 'replace') existingFixMode = 'replace-key'
  }

  let existingAgentId: string | null = null
  if (
    alreadyOnEtc === 'yes' &&
    typeof input.agent === 'string' &&
    input.agent.trim() &&
    input.reusableAgentIds.includes(input.agent.trim())
  ) {
    existingAgentId = input.agent.trim()
  }

  return { alreadyOnEtc, existingFixMode, existingAgentId }
}
