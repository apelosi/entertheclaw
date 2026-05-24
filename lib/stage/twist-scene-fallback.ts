/**
 * Deterministic fallback when the OpenRouter scene classifier misses a
 * director twist that explicitly relocates the action.
 */
import type { SceneClassifierResult } from './scene-classifier'

const RELOCATION_PATTERNS = [
  /\bscene\s+changes?\s+to\b/i,
  /\b(?:cut|fade|dissolve)\s+to\b/i,
  /\b(?:relocate|moves?|shift(?:s|ed)?)\s+(?:the\s+)?(?:scene|action)\s+to\b/i,
  /\bthe\s+action\s+(?:moves|shifts)\s+to\b/i,
]

/** True when a human director twist reads like an explicit relocation. */
export function twistExplicitlyRelocatesScene(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  return RELOCATION_PATTERNS.some((re) => re.test(t))
}

function capitalize(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function extractLocationClause(text: string): string | null {
  const patterns = [
    /\bscene\s+changes?\s+to\s+(.+)/i,
    /\b(?:cut|fade|dissolve)\s+to\s+(.+)/i,
    /\b(?:relocate|moves?|shift(?:s|ed)?)\s+(?:the\s+)?(?:scene|action)\s+to\s+(.+)/i,
    /\bthe\s+action\s+(?:moves|shifts)\s+to\s+(.+)/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) {
      return m[1].replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '')
    }
  }
  return null
}

/**
 * Build a scene_change payload from twist text when the LLM classifier fails
 * or is unavailable. Returns null when the twist does not look like relocation.
 */
export function buildSceneFallbackFromTwistText(
  text: string,
): Extract<SceneClassifierResult, { changed: true }> | null {
  if (!twistExplicitlyRelocatesScene(text)) return null

  const location = extractLocationClause(text)
  if (!location) return null

  const nameSegment = location.split(/[,;]/)[0]?.trim() || location
  const name = capitalize(nameSegment).slice(0, 120)
  const description = capitalize(location).slice(0, 800)

  return {
    changed: true,
    name,
    description,
    reason: 'Director twist relocated the scene.',
  }
}
