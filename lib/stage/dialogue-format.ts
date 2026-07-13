/**
 * Stage-direction markers in dialogue: [square brackets], not *asterisks*.
 *
 * Contract:
 * - [brackets] = unspoken physical action / staging (muted gray)
 * - "quotes"   = spoken dialogue (white)
 *
 * Repairs:
 * - Class A: close [brackets] before the first " inside a block that contains speech
 * - Class B: unwrap single-word [emphasis] inside quotes → plain spoken word
 */

const DOUBLE_ASTERISK = /\*\*([^*\n]+)\*\*/g
const SINGLE_ASTERISK = /\*([^*\n]+)\*/g
/** Single spoken token — not multi-word stage direction inside quotes. */
const EMPHASIS_TOKEN = /^[\w'-]+$/

function applyAsteriskRules(text: string, inQuotes: boolean): string {
  if (inQuotes) {
    return text.replace(DOUBLE_ASTERISK, '$1').replace(SINGLE_ASTERISK, '$1')
  }
  return text.replace(DOUBLE_ASTERISK, '[$1]').replace(SINGLE_ASTERISK, '[$1]')
}

/**
 * Outside "quotes": *action* → [action].
 * Inside "quotes": *emphasis* → plain word (no brackets).
 */
export function normalizeStageDirectionMarkers(text: string): string {
  let result = ''
  let i = 0
  while (i < text.length) {
    if (text[i] === '"') {
      let j = i + 1
      while (j < text.length && text[j] !== '"') j++
      if (j >= text.length) {
        result += applyAsteriskRules(text.slice(i), true)
        break
      }
      result += '"' + applyAsteriskRules(text.slice(i + 1, j), true) + '"'
      i = j + 1
    } else {
      const nextQuote = text.indexOf('"', i)
      const end = nextQuote === -1 ? text.length : nextQuote
      result += applyAsteriskRules(text.slice(i, end), false)
      i = end
    }
  }
  return result
}

/** Strip outer * / ** wrappers from a full-line emote (no brackets added). */
export function normalizeEmoteAction(text: string): string {
  const trimmed = text.trim()
  const double = trimmed.match(/^\*\*([^*\n]+)\*\*$/)
  if (double) return double[1].trim()
  const single = trimmed.match(/^\*([^*\n]+)\*$/)
  if (single) return single[1].trim()
  return trimmed
}

/** Find the index of the closing `]` for `[` at `start`, respecting nesting. */
function findCloseBracket(text: string, start: number): number {
  let depth = 1
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === '[') depth++
    else if (text[i] === ']') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** True when bracket content is a single spoken emphasis token, not stage direction. */
export function isEmphasisBracket(content: string): boolean {
  const trimmed = content.trim()
  return trimmed.length > 0 && !/\s/.test(trimmed) && EMPHASIS_TOKEN.test(trimmed)
}

/**
 * Class A: when a bracket block contains quoted speech, close the bracket before
 * the first `"` so dialogue renders white instead of inside gray stage direction.
 */
export function closeBracketBeforeQuotes(text: string): string {
  let result = ''
  let i = 0
  while (i < text.length) {
    if (text[i] !== '[') {
      result += text[i]
      i++
      continue
    }
    const closeIdx = findCloseBracket(text, i)
    if (closeIdx === -1) {
      result += text.slice(i)
      break
    }
    const inner = text.slice(i + 1, closeIdx)
    const firstQuote = inner.indexOf('"')
    if (firstQuote >= 0) {
      const action = inner.slice(0, firstQuote).trimEnd()
      const spoken = inner.slice(firstQuote)
      result += `[${action}] ${spoken}`
    } else {
      result += text.slice(i, closeIdx + 1)
    }
    i = closeIdx + 1
  }
  return result
}

/**
 * Class B: unwrap single-word [emphasis] inside quotes → plain spoken word.
 * `"it's [listening]."` → `"it's listening."`
 * Multi-word `[glances at the door]` inside quotes is left unchanged.
 */
export function unwrapEmphasisBracketsInQuotes(text: string): string {
  let result = ''
  let i = 0
  while (i < text.length) {
    if (text[i] !== '"') {
      result += text[i]
      i++
      continue
    }
    let j = i + 1
    while (j < text.length && text[j] !== '"') j++
    if (j >= text.length) {
      result += text.slice(i)
      break
    }
    const inner = text.slice(i + 1, j)
    const fixed = inner.replace(/\[([^\]]+)\]/g, (match, content: string) =>
      isEmphasisBracket(content) ? content.trim() : match,
    )
    result += `"${fixed}"`
    i = j + 1
  }
  return result
}

export interface DialogueRepairAnalysis {
  after: string
  /** Class A: quotes were trapped inside an outer [bracket] block. */
  classA: boolean
  /** Class B: single-word emphasis [word] inside quotes was unwrapped. */
  classB: boolean
}

/** Run repair steps and report which class(es) changed the line. */
export function analyzeDialogueRepair(text: string): DialogueRepairAnalysis {
  const normalized = normalizeStageDirectionMarkers(text)
  const afterA = closeBracketBeforeQuotes(normalized)
  const afterB = unwrapEmphasisBracketsInQuotes(afterA)
  return {
    after: afterB,
    classA: afterA !== normalized,
    classB: afterB !== afterA,
  }
}

/** Repair common agent formatting mistakes before display or persistence. */
export function repairDialogueFormatting(text: string): string {
  return analyzeDialogueRepair(text).after
}

export type DialogueSegment =
  | { kind: 'spoken'; text: string }
  | { kind: 'direction'; content: string }

/** Split stored dialogue into spoken runs and [bracketed] stage directions. */
export function splitDialogueSegments(text: string): DialogueSegment[] {
  const segments: DialogueSegment[] = []
  let i = 0
  while (i < text.length) {
    if (text[i] === '[') {
      const closeIdx = findCloseBracket(text, i)
      if (closeIdx === -1) {
        segments.push({ kind: 'direction', content: text.slice(i + 1) })
        return segments
      }
      segments.push({ kind: 'direction', content: text.slice(i + 1, closeIdx) })
      i = closeIdx + 1
    } else {
      const next = text.indexOf('[', i)
      const end = next === -1 ? text.length : next
      if (end > i) segments.push({ kind: 'spoken', text: text.slice(i, end) })
      i = end
    }
  }
  return segments.length > 0 ? segments : [{ kind: 'spoken', text: '' }]
}

/** Index of first character where two strings differ. */
export function firstDiffIndex(a: string, b: string): number {
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return i
  }
  return len
}

/** Rendered character length of a segment (including `[` `]` for directions). */
export function segmentRenderedLength(seg: DialogueSegment): number {
  return seg.kind === 'direction' ? seg.content.length + 2 : seg.text.length
}

/** Shared agent-facing formatting rule (keep prompts in sync with this). */
export const DIALOGUE_FORMAT_RULE =
  '[square brackets] are ONLY for physical actions the audience sees but does not hear (e.g. [glances at the door]). ' +
  'All spoken words go in "double quotes". Never put [brackets] around words inside quotes — write "it is listening", not "it is [listening]". ' +
  'For action without dialogue, use etc_emote. Do not use *asterisks*.'
