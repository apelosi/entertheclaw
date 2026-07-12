/**
 * Cheap pre-filters before calling the OpenRouter scene classifier.
 *
 * The gate is rules-based (regex keywords). When it passes, `classifyScene`
 * makes a semantic OpenRouter call to decide if the scene actually changes.
 * Current scene is always resolved from the DB without any LLM.
 */
import { twistExplicitlyRelocatesScene } from './twist-scene-fallback'

type SignalRule = { id: string; re: RegExp }

const LOCATION_WORDS =
  'hospital|dock(?:s)?|pier|warehouse|bakery|bedroom|corridor|elevator|cemetery|church|funeral(?:\\s+home)?|social\\s+club|post\\s+office|bank|vault|alley|rooftop|garden|courtyard|kitchen|bar|restaurant|station|garage|hallway|apartment|sidewalk|imports|mercantile|emergency\\s+room|waiting\\s+room|nursing\\s+home|clinic|morgue|chapel|graveyard|cemetery|dock(?:ing)?\\s+bay|loading\\s+bay|office|back\\s+room|study|ballroom|ballroom|reception'

const DIALOGUE_SIGNAL_RULES: SignalRule[] = [
  {
    id: 'arrive_at',
    re: /\barriv(?:e|es|ed|ing)\s+at\b/i,
  },
  {
    id: 'travel_to',
    re: /\b(?:walk(?:s|ed|ing)?|run(?:s|ning)?|drive(?:s|d|ing)?|head(?:s|ed|ing)?|go(?:es|ne|ing)?|mov(?:e|es|ed|ing)|rush(?:es|ed|ing)?)\s+to\b/i,
  },
  {
    id: 'enter_into',
    re: /\b(?:enter(?:s|ed|ing)?|step(?:s|ped|ping)?|walk(?:s|ed|ing)?|push(?:es|ed)?|pull(?:s|ed)?|stumble(?:s|d)?)\s+(?:in(?:to)?|through)\s+(?:the\s+)?/i,
  },
  {
    id: 'exit_from',
    re: /\b(?:step(?:s|ped|ping)?|walk(?:s|ed|ing)?|storm(?:s|ed)?|burst(?:s|ed)?|push(?:es|ed)?)\s+(?:out\s+of|from)\s+(?:the\s+)?/i,
  },
  {
    id: 'return_to',
    re: /\b(?:walk(?:s|ed|ing)?|step(?:s|ped|ping)?|come(?:s|s)?|return(?:s|ed|ing)?)\s+back\s+into\s+(?:the\s+)?/i,
  },
  {
    id: 'time_cut',
    re: /\b(?:cut\s+to|fade\s+to|dissolve\s+to|meanwhile|elsewhere|(?:hours?|days?|minutes?|weeks?)\s+later|(?:next|the\s+following)\s+(?:morning|afternoon|evening|night|day)|later\s+that|by\s+(?:morning|evening|dawn|nightfall))\b/i,
  },
  {
    id: 'we_are_at',
    re: /\b(?:we(?:'re|\s+are)|i(?:'m|\s+am)|he(?:'s|\s+is)|she(?:'s|\s+is))\s+(?:now\s+)?(?:at|in|back\s+at|inside|outside)\s+(?:the\s+)?/i,
  },
  {
    id: 'find_ourselves',
    re: /\bfind\s+(?:ourselves|yourself|themselves|himself|herself|myself)\s+(?:at|in)\b/i,
  },
  {
    id: 'at_named_place',
    re: new RegExp(
      `\\b(?:at|in|into|inside|through|from|out\\s+of|back\\s+into|on)\\s+(?:the\\s+)?(?:${LOCATION_WORDS})\\b`,
      'i',
    ),
  },
  {
    id: 'named_place_noun',
    re: new RegExp(
      `\\b(?:${LOCATION_WORDS})\\s+(?:corridor|room|doors|door|hallway|bed|floor|entrance|lobby|vault|desk|counter|window|street|avenue|block)\\b`,
      'i',
    ),
  },
  {
    id: 'bracket_location',
    re: /\[[^\]]{0,240}\b(?:stands?|sits?|walks?|steps?|drives?|pushes?|pulls?|enters?|arrives?|parks?|gets?\s+out|slides?\s+out|crosses?|hits?\s+the\s+gas)\b[^\]]{0,120}\b(?:at|in|into|inside|through|out\s+of|from|back\s+into|on|toward)\b[^\]]*\]/i,
  },
  {
    id: 'bracket_named_place',
    re: /\[[^\]]{0,240}\b(?:hospital|dock(?:s)?|pier|warehouse|bakery|bedroom|bank|post\s+office|social\s+club|emergency\s+room)\b[^\]]*\]/i,
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
    id: 'twist_at_named_place',
    re: new RegExp(
      `\\b(?:at|in|into|inside|through|from|out\\s+of|back\\s+into|on)\\s+(?:the\\s+)?(?:${LOCATION_WORDS})\\b`,
      'i',
    ),
  },
]

function matchRules(text: string, rules: SignalRule[]): string[] {
  const t = text.trim()
  if (!t) return []
  return rules.filter((r) => r.re.test(t)).map((r) => r.id)
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
): boolean {
  return kind === 'twist'
    ? twistMightRelocateScene(text)
    : dialogueMightChangeScene(text)
}

/** Labels for which keyword rules fired (for audit CSVs). */
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
