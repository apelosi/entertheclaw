/**
 * Normalized scene-name comparison for classifier gates and invariants.
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

export function normalizeSceneName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''\u2018\u2019\u201B]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function sceneContentTokens(name: string): string[] {
  return [...new Set(normalizeSceneName(name).split(' '))].filter(
    (w) => w.length > 2 && !STOP_WORDS.has(w),
  )
}

/** True when two scene names are the same after normalization. */
export function sceneNamesEqual(a: string, b: string): boolean {
  const na = normalizeSceneName(a)
  const nb = normalizeSceneName(b)
  return Boolean(na && nb && na === nb)
}
