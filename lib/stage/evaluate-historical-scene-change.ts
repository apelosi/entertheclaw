/**
 * Decide whether a persisted scene_change row should remain, using the same
 * rules as post-PR-#80 runtime (gate + invariants) plus name-only rephrase
 * detection for historical cleanup only.
 */
import { shouldRunSceneClassifier } from './scene-change-signals'
import {
  enforceSceneChangeInvariant,
  reasonContradictsRelocation,
} from './scene-classifier'
import { normalizeSceneName, sceneContentTokens, sceneNamesEqual } from './scene-name'

export type SceneSnapshot = { name: string; description: string }

export type SceneChangeAuditInput = {
  currentScene: SceneSnapshot
  sourceKind: 'dialogue' | 'twist'
  sourceText: string
  proposedName: string
  proposedDescription: string
  proposedReason: string
  isOpeningScene?: boolean
}

export type SceneChangeAuditResult = {
  keep: boolean
  reason: string
}

/** Name-only fuzzy match for rephrased same spot (historical cleanup only). */
export function scenesAreSameLocation(
  currentName: string,
  proposedName: string,
): boolean {
  const a = normalizeSceneName(currentName)
  const b = normalizeSceneName(proposedName)
  if (!a || !b) return false
  if (a === b) return true

  const short = a.length <= b.length ? a : b
  const long = a.length > b.length ? a : b
  if (short.length >= 12 && long.includes(short)) return true

  const tokensA = sceneContentTokens(currentName)
  const tokensB = sceneContentTokens(proposedName)
  if (tokensA.length === 0 || tokensB.length === 0) return false

  const setB = new Set(tokensB)
  const shared = tokensA.filter((t) => setB.has(t))
  if (shared.length === 0) return false

  const union = new Set([...tokensA, ...tokensB])
  const jaccard = shared.length / union.size

  if (shared.length >= 3 && jaccard >= 0.4) return true
  if (jaccard >= 0.55) return true

  return false
}

/**
 * True when the source line establishes a new vertical level (shaft floor,
 * cellar below room) rather than camera refresh in the same room.
 */
export function sourceDescendsToNewLevel(text: string): boolean {
  return /\b(?:drop(?:s|ped|ping)?\s+(?:first\s+)?into|descend(?:s|ed|ing)?\s+into|climb(?:s|ed|ing)?\s+down\s+into|lower(?:s|ed|ing)?\s+(?:herself|himself|themselves|myself|yourself)\s+into|falls?\s+into|jump(?:s|ed|ing)?\s+into)\s+(?:the\s+)?(?:shaft|passage|tunnel|cavern|pit|void)\b/i.test(
    text,
  )
}

export function auditHistoricalSceneChange(
  input: SceneChangeAuditInput,
): SceneChangeAuditResult {
  if (input.isOpeningScene) {
    return { keep: true, reason: 'opening_scene' }
  }

  const text = input.sourceText.trim()
  if (!text) {
    return { keep: false, reason: 'missing_source_text' }
  }

  if (
    !shouldRunSceneClassifier(
      input.sourceKind,
      text,
      input.currentScene.name,
    )
  ) {
    return { keep: false, reason: 'gate_would_skip' }
  }

  const invariant = enforceSceneChangeInvariant(input.currentScene, {
    changed: true,
    name: input.proposedName,
    description: input.proposedDescription,
    reason: input.proposedReason,
  })

  if (!invariant.changed) {
    if (sceneNamesEqual(input.currentScene.name, input.proposedName)) {
      return { keep: false, reason: 'identical_scene_name' }
    }
    if (reasonContradictsRelocation(input.proposedReason)) {
      return { keep: false, reason: 'reason_contradicts_relocation' }
    }
    return { keep: false, reason: 'invariant_rejected' }
  }

  if (scenesAreSameLocation(input.currentScene.name, input.proposedName)) {
    if (!sourceDescendsToNewLevel(text)) {
      return { keep: false, reason: 'same_location_rephrase' }
    }
  }

  // Hatch opened in same bronze chamber → vault label is still the same room.
  const currentNorm = normalizeSceneName(input.currentScene.name)
  const proposedNorm = normalizeSceneName(input.proposedName)
  if (
    currentNorm.includes('bronze chamber') &&
    proposedNorm.includes('vault') &&
    /\b(?:hatch|seam|pry|pri(?:ed|es|ing)|wrench(?:es|ed|ing)?)\b/i.test(text) &&
    !sourceDescendsToNewLevel(text)
  ) {
    return { keep: false, reason: 'hatch_open_same_room' }
  }

  return { keep: true, reason: 'valid_relocation' }
}

/**
 * Lines that clearly establish a new physical setting but never got a
 * scene_change row under the old classifier.
 */
export function detectMissedSceneChange(
  currentScene: SceneSnapshot,
  sourceKind: 'dialogue' | 'twist',
  sourceText: string,
): { missed: boolean; suggestedName: string; suggestedDescription: string } | null {
  const text = sourceText.trim()
  if (!text) return null

  if (
    !shouldRunSceneClassifier(sourceKind, text, currentScene.name)
  ) {
    return null
  }

  const hospitalMatch = text.match(
    /\[(?:the\s+)?hospital\s+corridor[^\]]*\]/i,
  )
  if (hospitalMatch) {
    const bracket = hospitalMatch[0].slice(1, -1)
    return {
      missed: true,
      suggestedName: 'Hospital corridor outside room 214, night',
      suggestedDescription:
        bracket.charAt(0).toUpperCase() +
        bracket.slice(1) +
        (bracket.endsWith('.') ? '' : '.'),
    }
  }

  return null
}
