/**
 * Pure helpers for the invite form "Yes — existing agent" path:
 * choose which agent early, then reuse that id for Keep / Replace / host wake.
 */

export function defaultExistingAgentId(
  reusableAgents: ReadonlyArray<{ id: string }>,
): string | null {
  return reusableAgents[0]?.id ?? null
}

/** Show the early Choose agent picker (before Keep / Replace). */
export function showEarlyExistingAgentPicker(input: {
  alreadyOnEtc: 'yes' | 'no' | null
  pasteReady: boolean
}): boolean {
  return input.alreadyOnEtc === 'yes' && !input.pasteReady
}

/** Keep / Replace actions require a selected named agent. */
export function canProceedExistingFix(existingAgentId: string | null): boolean {
  return Boolean(existingAgentId)
}
