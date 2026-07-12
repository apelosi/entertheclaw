/**
 * Detect when a proposed scene_change names the same physical location as the
 * current scene (rephrased camera/description refresh), so we skip emitting a
 * duplicate row.
 */

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'at',
  'in',
  'on',
  'of',
  'to',
  'and',
  'or',
  'for',
  'with',
  'from',
  'into',
  'near',
  'by',
  'edge',
  'east',
  'west',
  'north',
  'south',
  'fifty',
  'meters',
  'metres',
  'yards',
  'feet',
  'just',
  'still',
  'now',
  'same',
  'very',
  'this',
  'that',
  'here',
  'there',
])

function normalizeSceneName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function contentTokens(name: string): string[] {
  return [...new Set(normalizeSceneName(name).split(' '))].filter(
    (w) => w.length > 2 && !STOP_WORDS.has(w),
  )
}

/**
 * True when two scene names refer to the same physical location (allowing
 * rephrasing). Uses name tokens only — no description comparison.
 */
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

  const tokensA = contentTokens(currentName)
  const tokensB = contentTokens(proposedName)
  if (tokensA.length === 0 || tokensB.length === 0) return false

  const setB = new Set(tokensB)
  const shared = tokensA.filter((t) => setB.has(t))
  if (shared.length === 0) return false

  const union = new Set([...tokensA, ...tokensB])
  const jaccard = shared.length / union.size

  // Same spot rephrased: "vent grate at cantina ruins" vs "vent grate east of cantina"
  if (shared.length >= 3 && jaccard >= 0.4) return true
  if (jaccard >= 0.55) return true

  return false
}
