/**
 * Stage-direction markers in dialogue: [square brackets], not *asterisks*.
 * Agents often send *action* / **action**; normalize on ingest for display + export.
 *
 * Spoken lines use straight double quotes. Bracketed text is stage direction (muted).
 * Agents sometimes wrap quoted speech inside a single [bracket] block — repair
 * closes the bracket before the first quote and pulls [inline] markers out of quotes.
 */

const DOUBLE_ASTERISK = /\*\*([^*\n]+)\*\*/g
const SINGLE_ASTERISK = /\*([^*\n]+)\*/g

/** Replace *action* / **action** inline markers with [action]. */
export function normalizeStageDirectionMarkers(text: string): string {
  return text.replace(DOUBLE_ASTERISK, '[$1]').replace(SINGLE_ASTERISK, '[$1]')
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

/**
 * When a bracket block contains quoted speech, close the bracket before the
 * first `"` so dialogue renders white instead of inside gray stage direction.
 */
function closeBracketBeforeQuotes(text: string): string {
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
 * Pull [inline stage directions] out of quoted speech so they render muted.
 * `"word [breath] more"` → `"word " [breath] `"more"`
 */
function extractBracketsFromQuotes(text: string): string {
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
    const bracketRe = /\[([^\]]+)\]/g
    if (!bracketRe.test(inner)) {
      result += text.slice(i, j + 1)
    } else {
      bracketRe.lastIndex = 0
      let rebuilt = '"'
      let lastIdx = 0
      let match: RegExpExecArray | null
      while ((match = bracketRe.exec(inner)) !== null) {
        const before = inner.slice(lastIdx, match.index).trimEnd()
        rebuilt += before + '" [' + match[1] + '] "'
        lastIdx = match.index + match[0].length
      }
      rebuilt += inner.slice(lastIdx) + '"'
      result += rebuilt
    }
    i = j + 1
  }
  return result
}

/** Repair common agent formatting mistakes before display or persistence. */
export function repairDialogueFormatting(text: string): string {
  let t = normalizeStageDirectionMarkers(text)
  let prev = ''
  while (prev !== t) {
    prev = t
    t = closeBracketBeforeQuotes(t)
    t = extractBracketsFromQuotes(t)
  }
  return t
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
function firstDiffIndex(a: string, b: string): number {
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return i
  }
  return len
}

/** Index of last character in the differing region (inclusive). */
function lastDiffIndex(a: string, b: string, start: number): number {
  let iA = a.length - 1
  let iB = b.length - 1
  while (iA >= start && iB >= start && a[iA] === b[iB]) {
    iA--
    iB--
  }
  return Math.max(iA, iB)
}

/** Snippet centered on where before/after diverge — for CLI dry-run review. */
export function changeSnippet(
  before: string,
  after: string,
  context = 60,
): { before: string; after: string } {
  if (before === after) return { before, after }
  const start = firstDiffIndex(before, after)
  const end = lastDiffIndex(before, after, start)
  const clipStart = Math.max(0, start - context)
  const clipEndBefore = Math.min(before.length, end + context + 1)
  const clipEndAfter = Math.min(after.length, end + context + 1)
  const prefix = clipStart > 0 ? '…' : ''
  const suffixBefore = clipEndBefore < before.length ? '…' : ''
  const suffixAfter = clipEndAfter < after.length ? '…' : ''
  return {
    before: prefix + before.slice(clipStart, clipEndBefore) + suffixBefore,
    after: prefix + after.slice(clipStart, clipEndAfter) + suffixAfter,
  }
}

export { firstDiffIndex }

/** Rendered character length of a segment (including `[` `]` for directions). */
export function segmentRenderedLength(seg: DialogueSegment): number {
  return seg.kind === 'direction' ? seg.content.length + 2 : seg.text.length
}
