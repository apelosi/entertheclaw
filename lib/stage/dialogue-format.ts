/**
 * Stage-direction markers in dialogue: [square brackets], not *asterisks*.
 *
 * Contract:
 * - [brackets] = unspoken physical action / staging (muted gray)
 * - "quotes"   = spoken dialogue (white) — when outside [brackets]
 *
 * Repairs:
 * - Prep: strip tool leakage; normalize stored \" escapes; unwrap mistaken leading "
 * - Class C: bracket unbracketed stage direction between substantial spoken quotes; quote bare speech
 * - Class A: close [brackets] before trapped spoken dialogue (heuristic-gated)
 * - Class B: unwrap single-word [emphasis] inside quotes → plain spoken word
 * - Class D: trim trailing quote garbage (e.g. .""'); add missing closing " only when
 *   speech ends with . ! ? — not for mid-word agent truncations (leave those open)
 */

const DOUBLE_ASTERISK = /\*\*([^*\n]+)\*\*/g
const SINGLE_ASTERISK = /\*([^*\n]+)\*/g
/** Single spoken token — not multi-word stage direction inside quotes. */
const EMPHASIS_TOKEN = /^[\w'-]+$/

const TITLE_VERB_BEFORE_QUOTE =
  /\b(flagged|titled|named|called|labeled|reading|marked|filed|entitled)$/i
const POSSESSIVE_BEFORE_QUOTE = /\w+'s(?:\s*\\?)?$/
const EMBEDDED_PRONOUN_BEFORE_QUOTE =
  /\b(before|after|beside)\s+(he|she|they|it)$/i
const THE_WORD_BEFORE_QUOTE = /\bthe word$/i
const DIALOGUE_VERB_BEFORE_QUOTE =
  /\b(say|says|said|whisper|whispers|murmur|murmurs|crackles|shouts|asks|mutters|calls)\s*,?\s*$/i
/** First-person attribution / action — stage direction, not out-loud speech. */
const FIRST_PERSON_DIRECTION =
  /^I\s+(?:echo|whisper|mutter|murmur|press|step|steps|draw|turn|look|glance|reach|kneel|crouch|straighten|shift|limp|gasps?|watches?|glances?)\b/i
/** First-person lines that are the spoken words, not physical staging. */
const FIRST_PERSON_SPOKEN =
  /^I\s+(?:did|do|don't|does|can|will|would|have|had|am|was|were|see|saw|think|thought|know|knew|said|say|tells?|told|mean|meant|need|want|gave|give|didn't)\b/i

function isEscapedAt(text: string, index: number): boolean {
  return index > 0 && text[index - 1] === '\\'
}

/** Closing `"` index for opener at `openIdx`, or -1 when unclosed. */
export function findCloseQuote(text: string, openIdx: number): number {
  let j = openIdx + 1
  while (j < text.length) {
    if (isEscapedAt(text, j)) {
      j += 2
      continue
    }
    if (text[j] === '"') return j
    j++
  }
  return -1
}

/** Content inside `"..."` starting at `openIdx` (excluding delimiters). */
export function spokenQuoteContent(text: string, openIdx: number): string | null {
  if (text[openIdx] !== '"' || isEscapedAt(text, openIdx)) return null
  const closeIdx = findCloseQuote(text, openIdx)
  if (closeIdx < 0) return null
  return text.slice(openIdx + 1, closeIdx)
}

/** Short cited words ("Sera", "complete.") are not spoken dialogue spans. */
export function isSubstantialSpokenQuoteContent(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed) return false
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length >= 3) return true
  return trimmed.length >= 20
}

/** True when `"` at `index` opens substantial out-loud speech outside [brackets]. */
export function isSubstantialSpokenQuoteAt(text: string, index: number): boolean {
  if (text[index] !== '"' || isEscapedAt(text, index)) return false
  const content = spokenQuoteContent(text, index)
  if (content === null) return false
  return isSubstantialSpokenQuoteContent(content)
}

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
    if (text[i] === '"' && !isEscapedAt(text, i)) {
      const closeIdx = findCloseQuote(text, i)
      if (closeIdx < 0) {
        result += applyAsteriskRules(text.slice(i), true)
        break
      }
      result += '"' + applyAsteriskRules(text.slice(i + 1, closeIdx), true) + '"'
      i = closeIdx + 1
    } else {
      const nextQuote = indexOfSpokenQuoteFrom(text, i, false)
      const end = nextQuote === -1 ? text.length : nextQuote
      result += applyAsteriskRules(text.slice(i, end), false)
      i = end
    }
  }
  return result
}

/** Strip outer * / ** wrappers from a full-line emote (no brackets added). */
export function normalizeEmoteAction(text: string): string {
  const trimmed = stripAgentToolLeakage(text).trim()
  const double = trimmed.match(/^\*\*([^*\n]+)\*\*$/)
  if (double) return double[1].trim()
  const single = trimmed.match(/^\*([^*\n]+)\*$/)
  if (single) return single[1].trim()
  return trimmed
}

const AGENT_TOOL_LEAK = /^(?:etc_(?:emote|speak|claim_turn)|etc)\s+/i

/** Remove tool names agents sometimes paste into line content. */
export function stripAgentToolLeakage(text: string): string {
  let result = text.trimStart()
  while (AGENT_TOOL_LEAK.test(result)) {
    result = result.replace(AGENT_TOOL_LEAK, '').trimStart()
  }
  return result
}

/** Index of the first `"` outside any [bracket] block (spoken dialogue opener). */
export function indexOfFirstSpokenQuote(text: string): number {
  return indexOfSpokenQuoteFrom(text, 0, false)
}

/** Index of the first substantial spoken `"` outside [brackets]. */
export function indexOfFirstSubstantialSpokenQuote(text: string): number {
  return indexOfSpokenQuoteFrom(text, 0, true)
}

/** True when stored emote text includes out-loud dialogue in quotes. */
export function emoteContainsDialogue(text: string): boolean {
  return indexOfFirstSpokenQuote(text) >= 0
}

/**
 * Prep: strip a mistaken leading `"` when the line should start with `[action]`.
 * `"[glances away] "Hello."` → `[glances away] "Hello."`
 */
export function unwrapOuterDialogueQuotes(text: string): string {
  const trimmed = text.trim()
  if (trimmed.startsWith('"[')) return trimmed.slice(1)
  return trimmed
}

/** Normalize literal backslash-quote sequences stored in legacy rows. */
export function normalizeStoredQuoteEscapes(text: string): string {
  return text.replace(/\\"/g, '"')
}

/**
 * `] 'speech...'"` → `] "speech..."` — legacy single-quote dialogue with a stray closing `"`.
 */
export function normalizeSingleQuotedSpeechAfterAction(text: string): string {
  let trimmed = text.trimEnd()
  if (trimmed.endsWith('"') && !trimmed.endsWith('\\"')) {
    const withoutTrailing = trimmed.slice(0, -1).trimEnd()
    const match = withoutTrailing.match(/^([\s\S]*?\])\s+'([\s\S]+)'$/)
    if (match && match[2].length >= 15) {
      return `${match[1]} "${match[2]}"`
    }
  }
  return text
}

/**
 * Class C runs when the line has substantial spoken quotes, or short quoted beats
 * followed by a new staging sentence (`"Palermo." Then his arm...`).
 */
export function shouldRunClassC(text: string): boolean {
  if (indexOfFirstSubstantialSpokenQuote(text) >= 0) return true
  let i = 0
  while (i < text.length) {
    const q = indexOfSpokenQuoteFrom(text, i, false)
    if (q < 0) break
    const close = findCloseQuote(text, q)
    if (close < 0) {
      const before = text.slice(0, q).trim()
      if (before && !before.endsWith('[')) return true
      break
    }
    const tail = text.slice(close + 1).trimStart()
    if (tail && /^[A-Z][a-z]+\b/.test(tail) && !tail.startsWith('[')) return true
    i = close + 1
  }
  return false
}

/**
 * Prep: drop a mistaken opening `"` when the first span is stage direction
 * and more quoted speech follows (`"Pyros runs... "I have forged..."`).
 */
export function unwrapMistakenLeadingQuote(text: string): string {
  const trimmed = text.trim()
  if (!trimmed.startsWith('"') || trimmed.startsWith('"[')) return trimmed
  const closeIdx = findCloseQuote(trimmed, 0)
  if (closeIdx < 0) return trimmed
  const firstSpan = trimmed.slice(1, closeIdx)
  const rest = trimmed.slice(closeIdx + 1)
  if (!rest.trim()) return trimmed
  if (!/[.!?]\s*$/.test(firstSpan.trim())) return trimmed
  if (indexOfSpokenQuoteFrom(rest, 0, false) < 0) return trimmed
  return trimmed.slice(1)
}

/** Wrap bare prose as [direction] or "speech" depending on content. */
export function wrapBareProse(prose: string): string {
  const trimmed = prose.trim()
  if (!trimmed) return prose
  if (FIRST_PERSON_SPOKEN.test(trimmed) && !FIRST_PERSON_DIRECTION.test(trimmed)) {
    const lead = prose.match(/^\s*/)?.[0] ?? ''
    const trail = prose.match(/\s*$/)?.[0] ?? ''
    return `${lead}"${trimmed}"${trail}`
  }
  const lead = prose.match(/^\s*/)?.[0] ?? ''
  const trail = prose.match(/\s*$/)?.[0] ?? ''
  return `${lead}[${trimmed}]${trail}`
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
 * Quoted text inside [brackets] that should stay gray — a title, cited phrase,
 * or referenced word, not the start of out-loud dialogue.
 */
export function isEmbeddedCitationInBrackets(beforeQuote: string): boolean {
  const b = beforeQuote.trimEnd()
  if (THE_WORD_BEFORE_QUOTE.test(b)) return true
  if (TITLE_VERB_BEFORE_QUOTE.test(b)) return true
  if (POSSESSIVE_BEFORE_QUOTE.test(b)) return true
  if (EMBEDDED_PRONOUN_BEFORE_QUOTE.test(b)) return true
  return false
}

/**
 * True when `"` inside a [bracket] block likely starts spoken dialogue that
 * should render white outside the brackets (Class A), not an in-action citation.
 */
export function isDialogueOpenerInBrackets(beforeQuote: string): boolean {
  if (isEmbeddedCitationInBrackets(beforeQuote)) return false
  const b = beforeQuote.trimEnd()
  if (/[.!?]\s*$/.test(b)) return true
  if (/:\s*$/.test(b)) return true
  if (DIALOGUE_VERB_BEFORE_QUOTE.test(b)) return true
  return false
}

/**
 * Class A: when a bracket block contains quoted speech, close the bracket before
 * the first dialogue-opening `"` so speech renders white instead of inside gray.
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
    if (firstQuote >= 0 && isDialogueOpenerInBrackets(inner.slice(0, firstQuote))) {
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
 * Repair mistaken Class C wrap: `[prose [inner]] "speech"` → `[prose] [inner] "speech"`.
 */
export function fixDoubleClosedDirectionBeforeQuote(text: string): string {
  const quoteIdx = indexOfFirstSpokenQuote(text)
  if (quoteIdx < 0) return text
  const prefix = text.slice(0, quoteIdx).trimEnd()
  const suffix = text.slice(quoteIdx)
  if (!prefix.endsWith(']]')) return text
  const match = prefix.match(/^\[([^\[]*)\[([^\]]+)\]\]$/)
  if (!match) return text
  const outerTrim = match[1].trim()
  const innerTrim = match[2].trim()
  // Single-word emphasis inside an outer bracket (e.g. It's [listening.]]) is Class B territory,
  // not a mistaken double-close — splitting would regress be429002-style lines.
  if (isEmphasisBracket(innerTrim.replace(/\.$/, ''))) return text
  if (!outerTrim) return `[${innerTrim}] ${suffix}`
  return `[${outerTrim}] [${innerTrim}] ${suffix}`
}

/** Index of the first `"` outside [brackets] at or after `start`. */
function indexOfSpokenQuoteFrom(text: string, start: number, substantialOnly: boolean): number {
  let bracketDepth = 0
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (ch === '[') bracketDepth++
    else if (ch === ']' && bracketDepth > 0) bracketDepth--
    else if (ch === '"' && bracketDepth === 0 && !isEscapedAt(text, i)) {
      if (!substantialOnly || isSubstantialSpokenQuoteAt(text, i)) return i
    }
  }
  return -1
}

/** Next index of `[` or spoken `"` at or after `start`. */
function indexOfNextBracketOrSpokenQuote(text: string, start: number): number {
  const nextBracket = text.indexOf('[', start)
  const nextQuote = indexOfSpokenQuoteFrom(text, start, false)
  if (nextBracket === -1) return nextQuote === -1 ? text.length : nextQuote
  if (nextQuote === -1) return nextBracket
  return Math.min(nextBracket, nextQuote)
}

/**
 * Class C: wrap every unbracketed prose run in [brackets].
 * `Kaelen's eye flickers. "Hello."` → `[Kaelen's eye flickers.] "Hello."`
 * `...master." He looks. "And..."` → `...master." [He looks.] "And..."`
 * When an inner `[action]` already exists: `[prose] [inner] "Hello."` — not `[prose [inner]]`.
 */
export function wrapUnbracketedDirectionBeforeQuotes(text: string): string {
  if (!shouldRunClassC(text)) return text

  let result = ''
  let i = 0
  while (i < text.length) {
    if (text[i] === '[') {
      const closeIdx = findCloseBracket(text, i)
      if (closeIdx === -1) {
        result += text.slice(i)
        break
      }
      result += text.slice(i, closeIdx + 1)
      i = closeIdx + 1
      continue
    }
    if (text[i] === '"' && !isEscapedAt(text, i)) {
      const closeIdx = findCloseQuote(text, i)
      if (closeIdx < 0) {
        result += text.slice(i)
        break
      }
      result += text.slice(i, closeIdx + 1)
      i = closeIdx + 1
      continue
    }
    const nextSpecial = indexOfNextBracketOrSpokenQuote(text, i)
    const chunk = text.slice(i, nextSpecial)
    if (chunk.trim()) {
      result += wrapBareProse(chunk)
    } else {
      result += chunk
    }
    i = nextSpecial
  }
  return result
}

/** Spoken text after the last unclosed `"` outside `[brackets]`, or null if balanced. */
export function unclosedSpokenTail(text: string): string | null {
  let bracketDepth = 0
  let quotes = 0
  let lastQuoteIdx = -1
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '[') bracketDepth++
    else if (ch === ']' && bracketDepth > 0) bracketDepth--
    else if (ch === '"' && bracketDepth === 0 && !isEscapedAt(text, i)) {
      quotes++
      lastQuoteIdx = i
    }
  }
  if (quotes % 2 === 0 || lastQuoteIdx < 0) return null
  return text.slice(lastQuoteIdx + 1)
}

/**
 * True when an unclosed spoken quote looks complete (ends . ! ?) and only
 * lacks a closing `"`. Mid-word agent truncations are left open on purpose.
 */
export function shouldAppendClosingQuote(text: string): boolean {
  const tail = unclosedSpokenTail(text)
  if (tail === null) return false
  const spoken = tail.trimEnd()
  if (!spoken) return false
  return /[.!?]$/.test(spoken)
}

/** Append a closing `"` only for complete sentences missing the final quote. */
export function ensureClosingQuote(text: string): string {
  if (shouldAppendClosingQuote(text)) return text + '"'
  return text
}

/**
 * Class D: fix trailing quote garbage (`.""'`) and balance missing closers.
 */
export function normalizeDialogueQuotes(text: string): string {
  let result = ensureClosingQuote(text)
  result = result.replace(/(\.)"["']+$/g, '$1"')
  return result
}

export function unwrapEmphasisBracketsInQuotes(text: string): string {
  let result = ''
  let i = 0
  while (i < text.length) {
    if (text[i] !== '"' || isEscapedAt(text, i)) {
      result += text[i]
      i++
      continue
    }
    const closeIdx = findCloseQuote(text, i)
    if (closeIdx < 0) {
      result += text.slice(i)
      break
    }
    const inner = text.slice(i + 1, closeIdx)
    const fixed = inner.replace(/\[([^\]]+)\]/g, (match, content: string) =>
      isEmphasisBracket(content) ? content.trim() : match,
    )
    result += `"${fixed}"`
    i = closeIdx + 1
  }
  return result
}

/** Unwrap nested single-word [emphasis] inside outer [stage-direction] blocks. */
export function unwrapEmphasisBracketsInDirections(text: string): string {
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
    const fixed = inner.replace(/\[([^\]]+)\]/g, (match, content: string) => {
      const token = content.trim().replace(/\.$/, '')
      return isEmphasisBracket(token) ? content.trim() : match
    })
    result += `[${fixed}]`
    i = closeIdx + 1
  }
  return result
}

export interface DialogueRepairAnalysis {
  after: string
  /** Prep: stripped etc_emote/etc_speak or leading outer quote. */
  prep: boolean
  /** Class C: wrapped unbracketed stage direction before spoken quotes. */
  classC: boolean
  /** Class A: quotes were trapped inside an outer [bracket] block. */
  classA: boolean
  /** Class B: single-word emphasis [word] inside quotes was unwrapped. */
  classB: boolean
  /** Class D: balanced or trimmed stray closing quotes. */
  classD: boolean
}

/** Run repair steps and report which class(es) changed the line. */
export function analyzeDialogueRepair(text: string): DialogueRepairAnalysis {
  const stripped = stripAgentToolLeakage(text)
  const escaped = normalizeStoredQuoteEscapes(stripped)
  const singleQuoted = normalizeSingleQuotedSpeechAfterAction(escaped)
  const unwrappedOuter = unwrapOuterDialogueQuotes(singleQuoted)
  const unwrapped = unwrapMistakenLeadingQuote(unwrappedOuter)
  const normalized = normalizeStageDirectionMarkers(unwrapped)
  const afterFixDouble = fixDoubleClosedDirectionBeforeQuote(normalized)
  const afterC = wrapUnbracketedDirectionBeforeQuotes(afterFixDouble)
  const afterEmphasisDirs = unwrapEmphasisBracketsInDirections(afterC)
  const afterA = closeBracketBeforeQuotes(afterEmphasisDirs)
  const afterB = unwrapEmphasisBracketsInQuotes(afterA)
  const afterD = normalizeDialogueQuotes(afterB)
  return {
    after: afterD,
    prep:
      stripped !== text ||
      escaped !== stripped ||
      singleQuoted !== escaped ||
      unwrappedOuter !== singleQuoted ||
      unwrapped !== unwrappedOuter,
    classC: afterC !== normalized || afterFixDouble !== normalized,
    classA: afterA !== afterEmphasisDirs,
    classB: afterB !== afterA || afterEmphasisDirs !== afterC,
    classD: afterD !== afterB,
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

/** Line-format rules for etc_speak content (not tool invocation). */
export const DIALOGUE_SPEAK_FORMAT_RULE =
  '[square brackets] are ONLY for physical actions the audience sees but does not hear (e.g. [glances at the door]). ' +
  'All spoken words go in "double quotes" outside [brackets]. Never put [brackets] around words inside quotes — write "it is listening", not "it is [listening]". ' +
  'Quoted titles or cited phrases inside [brackets] stay in the narration. Do not use *asterisks*. ' +
  'Output only the line text — never prefix with tool names like etc_emote or etc_speak.'

/**
 * Shared agent-facing formatting rule (keep prompts in sync with this).
 * etc_emote is a separate tool call — do not mention it inside speak-line rules
 * or models leak "etc_emote" into dialogue text.
 */
export const DIALOGUE_FORMAT_RULE =
  DIALOGUE_SPEAK_FORMAT_RULE +
  ' For silent physical action with no spoken words, call the etc_emote tool (do not write etc_emote in the line).'

/** Format a stored line for RECENT DIALOGUE / memory — repaired, no extra quote wrapping. */
export function formatDialogueLineForPrompt(speakerName: string, text: string): string {
  return `${speakerName}: ${repairDialogueFormatting(text)}`
}
