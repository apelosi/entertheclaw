/**
 * Structural pre-filters before calling the OpenRouter scene classifier.
 *
 * Genre-agnostic: no hardcoded place nouns (hospital, cantina, etc.). Detects
 * relocation *shape* — bracket stage directions, travel verbs, time cuts —
 * then lets the LLM decide if the scene actually moves.
 *
 * When `currentSceneName` is provided, bracket-only staging that references
 * place tokens already in the current scene is treated as in-scene movement
 * (no OpenRouter call).
 */
import { sceneContentTokens } from './scene-name'
import { twistExplicitlyRelocatesScene } from './twist-scene-fallback'

type SignalRule = { id: string; re: RegExp }

const DIALOGUE_SIGNAL_RULES: SignalRule[] = [
  {
    id: 'arrive_at',
    re: /\barriv(?:e|es|ed|ing)\s+at\b/i,
  },
  {
    id: 'travel_to',
    re: /\b(?:walk(?:s|ed|ing)?|run(?:s|ning)?|drive(?:s|d|ing)?|head(?:s|ed|ing)?|go(?:es|ne|ing)?|mov(?:e|es|ed|ing)|rush(?:es|ed|ing)?|ride(?:s|s)?|gallop(?:s|ed|ing)?)\s+to\b/i,
  },
  {
    id: 'enter_into',
    re: /\b(?:enter(?:s|ed|ing)?|step(?:s|ped|ping)?|walk(?:s|ed|ing)?|push(?:es|ed)?|pull(?:s|ed)?|stumble(?:s|d)?|descend(?:s|ed|ing)?|ascend(?:s|ed|ing)?|emerg(?:e|es|ed|ing)?)\s+(?:in(?:to)?|through)\s+(?:the\s+)?/i,
  },
  {
    id: 'exit_from',
    re: /\b(?:step(?:s|ped|ping)?|walk(?:s|ed|ing)?|storm(?:s|ed)?|burst(?:s|ed)?|push(?:es|ed)?|flee(?:s|d|ing)?)\s+(?:out\s+of|from)\s+(?:the\s+)?/i,
  },
  {
    id: 'return_to',
    re: /\b(?:walk(?:s|ed|ing)?|step(?:s|ped|ping)?|come(?:s|s)?|return(?:s|ed|ing)?)\s+back\s+into\s+(?:the\s+)?/i,
  },
  {
    id: 'time_cut',
    re: /\b(?:cut\s+to|fade\s+to|dissolve\s+to|meanwhile|elsewhere|(?:hours?|days?|minutes?|weeks?|months?|years?)\s+later|(?:next|the\s+following)\s+(?:morning|afternoon|evening|night|day)|later\s+that|by\s+(?:morning|evening|dawn|nightfall|sunrise|sunset))\b/i,
  },
  {
    id: 'we_are_at',
    re: /\b(?:we(?:'re|\s+are)|i(?:'m|\s+am)|he(?:'s|\s+is)|she(?:'s|\s+is)|they(?:'re|\s+are))\s+(?:now\s+)?(?:at|in|back\s+at|inside|outside)\s+(?:the\s+)?/i,
  },
  {
    id: 'find_ourselves',
    re: /\bfind\s+(?:ourselves|yourself|themselves|himself|herself|myself)\s+(?:at|in)\b/i,
  },
  {
    id: 'bracket_staging',
    re: /\[[^\]]{0,320}\b(?:stands?|sits?|kneels?|walks?|steps?|drives?|pushes?|pulls?|enters?|arrives?|parks?|gets?\s+out|slides?\s+out|crosses?|descends?|ascends?|emerges?|waits?|paces?|leans?|perches?)\b[^\]]*\]/i,
  },
  {
    id: 'stage_dir_marker',
    re: /\*\s*(?:cut|fade|scene|enter|exit|we\s+(?:are|arrive))/i,
  },
  {
    id: 'location_tag',
    re: /\[(?:scene|location|cut)\s*:/i,
  },
]

const TWIST_IMPLICIT_RULES: SignalRule[] = [
  {
    id: 'twist_explosion',
    re: /\b(?:explod(?:e|es|ed|ing)?|(?:building|roof|wall|ceiling)\s+collapse(?:s|d|ing)?|fire\s+breaks?\s+out)\b/i,
  },
  {
    id: 'twist_suddenly_at',
    re: /\b(?:suddenly|now)\s+(?:in|at|outside|inside)\b/i,
  },
  {
    id: 'twist_new_setting',
    re: /\bnew\s+(?:location|setting|scene)\b/i,
  },
  {
    id: 'twist_return',
    re: /\b(?:back\s+at|returns?\s+to|wakes?\s+(?:up\s+)?(?:in|at))\b/i,
  },
  {
    id: 'twist_time_cut',
    re: /\b(?:cut\s+to|fade\s+to|dissolve\s+to|(?:hours?|days?|weeks?)\s+later)\b/i,
  },
  {
    id: 'twist_travel',
    re: /\b(?:arriv(?:e|es|ed|ing)\s+at|travel(?:s|ed|ing)?\s+to|mov(?:e|es|ed|ing)\s+to)\b/i,
  },
]

/** Rules that always warrant an LLM check when they fire. */
const STRONG_DIALOGUE_RULES = new Set([
  'arrive_at',
  'travel_to',
  'enter_into',
  'exit_from',
  'return_to',
  'time_cut',
  'we_are_at',
  'find_ourselves',
  'stage_dir_marker',
  'location_tag',
])

function matchRules(text: string, rules: SignalRule[]): string[] {
  const t = text.trim()
  if (!t) return []
  return rules.filter((r) => r.re.test(t)).map((r) => r.id)
}

const MOTION_OR_FILLER = new Set([
  'toward',
  'towards',
  'forward',
  'through',
  'pulsing',
  'pressing',
  'crackling',
  'trembling',
  'flickering',
  'counter',
  'beside',
  'against',
  'along',
  'around',
  'across',
  'closer',
  'slowly',
  'quickly',
])

function extractBracketChunks(text: string): string[] {
  return [...text.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1])
}

function bracketIntroducesNovelPlace(
  bracket: string,
  sceneTokenSet: Set<string>,
): boolean {
  const cues = [
    ...bracket.matchAll(
      /\b(?:toward|towards|to|into|through|at|in|on|near|beside|against)\s+(?:the\s+|a\s+)?([^.[\]]{3,80})/gi,
    ),
  ]
  for (const m of cues) {
    if (/\b(?:my|your|his|her|their|our|its)\b/i.test(m[1])) continue
    const phraseTokens = sceneContentTokens(m[1]).filter(
      (t) => t.length >= 4 && !MOTION_OR_FILLER.has(t),
    )
    if (phraseTokens.some((t) => !sceneTokenSet.has(t))) return true
  }

  const settingMatch = bracket.match(
    /\b(?:the\s+)?([a-z][a-z\s']{2,50}?)\s+(?:is|are|was|were)\b/i,
  )
  if (settingMatch) {
    const phraseTokens = sceneContentTokens(settingMatch[1]).filter(
      (t) => t.length >= 4,
    )
    if (phraseTokens.some((t) => !sceneTokenSet.has(t))) return true
  }

  const strongInBracket = matchRules(bracket, DIALOGUE_SIGNAL_RULES).some(
    (id) => STRONG_DIALOGUE_RULES.has(id),
  )
  return strongInBracket
}

/**
 * Bracket staging that only references place tokens already present in the
 * current scene name (e.g. "step toward the grate" while already at the vent
 * grate) is movement within the scene, not a relocation.
 */
export function bracketStagingAnchoredToCurrentScene(
  currentSceneName: string,
  text: string,
): boolean {
  const rules = matchRules(text, DIALOGUE_SIGNAL_RULES)
  if (!rules.includes('bracket_staging')) return false
  if (rules.some((id) => STRONG_DIALOGUE_RULES.has(id))) return false

  const brackets = extractBracketChunks(text)
  if (brackets.length === 0) return false

  const sceneTokenSet = new Set(sceneContentTokens(currentSceneName))

  return brackets.every((bracket) => {
    if (bracketIntroducesNovelPlace(bracket, sceneTokenSet)) return false
    return sceneContentTokens(bracket).some(
      (t) => t.length >= 4 && sceneTokenSet.has(t),
    )
  })
}

/** True when an in-character line might relocate the scene. */
export function dialogueMightChangeScene(text: string): boolean {
  return matchRules(text, DIALOGUE_SIGNAL_RULES).length > 0
}

/** True when a director twist might relocate the scene (explicit or implicit). */
export function twistMightRelocateScene(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (twistExplicitlyRelocatesScene(t)) return true
  return matchRules(t, TWIST_IMPLICIT_RULES).length > 0
}

/** Gate for whether `classifyScene` should call OpenRouter for this event. */
export function shouldRunSceneClassifier(
  kind: 'dialogue' | 'twist',
  text: string,
  currentSceneName?: string,
): boolean {
  if (kind === 'twist') {
    return twistMightRelocateScene(text)
  }

  if (!dialogueMightChangeScene(text)) return false

  if (
    currentSceneName &&
    bracketStagingAnchoredToCurrentScene(currentSceneName, text)
  ) {
    return false
  }

  return true
}

/** Labels for which structural rules fired (for audit CSVs). */
export function getMatchingRelocationSignals(
  kind: 'dialogue' | 'twist',
  text: string,
): string[] {
  const t = text.trim()
  if (!t) return []
  if (kind === 'twist') {
    const hits = matchRules(t, TWIST_IMPLICIT_RULES)
    if (twistExplicitlyRelocatesScene(t)) hits.unshift('twist_explicit_relocation')
    return hits
  }
  return matchRules(t, DIALOGUE_SIGNAL_RULES)
}
