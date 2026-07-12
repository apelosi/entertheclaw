/**
 * Cheap pre-filters before calling the OpenRouter scene classifier.
 *
 * The classifier only needs to run when a line might relocate the action.
 * Routine in-character dialogue and emotional director twists skip the LLM
 * entirely; current scene is already resolved from the DB via
 * `resolveCurrentScene`.
 */
import { twistExplicitlyRelocatesScene } from './twist-scene-fallback'

const DIALOGUE_RELOCATION_SIGNALS = [
  // Movement / travel toward a destination
  /\b(?:arriv(?:e|es|ed|ing)\s+at|enter(?:s|ed|ing)?\s+(?:the\s+)?|walk(?:s|ed|ing)?\s+(?:to|into)|run(?:s|ning)?\s+(?:to|into)|drive(?:s|d|ing)?\s+to|head(?:s|ed|ing)?\s+to|go(?:es|ne|ing)?\s+to|mov(?:e|es|ed|ing)\s+to|step(?:s|ped|ping)?\s+into|rush(?:es|ed|ing)?\s+(?:to|into)|stumble(?:s|d)?\s+into|pull(?:s|ed)?\s+into)\b/i,
  // Hard cuts / time jumps
  /\b(?:cut\s+to|fade\s+to|dissolve\s+to|meanwhile|elsewhere)\b/i,
  /\b(?:hours?|days?|minutes?|weeks?)\s+later\b/i,
  /\b(?:next|the\s+following)\s+(?:morning|afternoon|evening|night|day)\b/i,
  /\b(?:later\s+that|by\s+(?:morning|evening|dawn|nightfall))\b/i,
  // Declared location shifts
  /\b(?:we(?:'re|\s+are)\s+(?:now\s+)?(?:at|in|back\s+at|inside|outside))\b/i,
  /\b(?:find\s+(?:ourselves|yourself|themselves)\s+(?:at|in))\b/i,
  /\b(?:now\s+(?:at|in|back))\b/i,
  // Stage-direction style (common in agent lines)
  /\*\s*(?:cut|fade|scene|enter|exit|we\s+(?:are|arrive))/i,
  /\[(?:scene|location|cut)\s*:/i,
] as const

const TWIST_IMPLICIT_RELOCATION_SIGNALS = [
  /\b(?:explod(?:e|es|ed|ing)?|(?:building|roof|wall|ceiling)\s+collapse(?:s|d|ing)?|fire\s+breaks?\s+out)\b/i,
  /\b(?:suddenly|now)\s+(?:in|at|outside|inside)\b/i,
  /\bnew\s+(?:location|setting|scene)\b/i,
  /\b(?:back\s+at|returns?\s+to|wakes?\s+(?:up\s+)?(?:in|at))\b/i,
] as const

function matchesAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((re) => re.test(text))
}

/** True when an in-character line might relocate the scene. */
export function dialogueMightChangeScene(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  return matchesAny(t, DIALOGUE_RELOCATION_SIGNALS)
}

/** True when a director twist might relocate the scene (explicit or implicit). */
export function twistMightRelocateScene(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (twistExplicitlyRelocatesScene(t)) return true
  return matchesAny(t, TWIST_IMPLICIT_RELOCATION_SIGNALS)
}

/** Gate for whether `classifyScene` should call OpenRouter for this event. */
export function shouldRunSceneClassifier(
  kind: 'dialogue' | 'twist',
  text: string,
): boolean {
  return kind === 'twist'
    ? twistMightRelocateScene(text)
    : dialogueMightChangeScene(text)
}
