/**
 * Stage-direction markers in dialogue: [square brackets], not *asterisks*.
 *
 * Contract:
 * - [brackets] = unspoken physical action / staging (muted gray)
 * - "quotes"   = spoken dialogue (white) — when outside [brackets]
 *
 * Repairs:
 * - Prep: strip tool leakage; normalize smart/curly quotes + stored \" escapes;
 *   unwrap mistaken leading "; convert outer-"…'speech'" wraps; strip trailing junk
 * - Class E: reverse inverted speech-in-brackets mangling (`[speech.]" [act] "[speech.]"`)
 * - Class C: bracket unbracketed stage direction between substantial spoken quotes; quote bare speech
 * - Class A: close [brackets] before trapped spoken dialogue (heuristic-gated)
 * - Class B: unwrap short [emphasis] inside quotes → plain spoken words
 * - Class F: split `"Speech. [action] More speech."` into separate quote spans
 * - Class D: trim trailing quote garbage (e.g. .""'); add missing closing " only when
 *   speech ends with . ! ? — not for mid-word agent truncations (leave those open)
 */

const DOUBLE_ASTERISK = /\*\*([^*\n]+)\*\*/g
const SINGLE_ASTERISK = /\*([^*\n]+)\*/g
/** Single spoken token — not multi-word stage direction inside quotes. */
const EMPHASIS_TOKEN = /^[\w'-]+$/
/** Physical-action verbs — content with these is stage direction, not spoken emphasis. */
const STAGE_ACTION_VERB =
  /\b(glances?|presses?|steps?|draws?|turns?|looks?|reaches?|runs?|pulls?|holds?|whispers?|mutters?|points?|spits?|jerks?|twitches?|opens?|closes?|raises?|lowers?|nods?|shakes?|traces?|flicks?|flickers?|drifts?|locks?|snaps?|forces?|falls?|escapes?|crouches?|scans?|scanning)\b/i

const TITLE_VERB_BEFORE_QUOTE =
  /\b(flagged|titled|named|called|labeled|reading|marked|filed|entitled)$/i
const POSSESSIVE_BEFORE_QUOTE = /\w+'s(?:\s*\\?)?$/
const EMBEDDED_PRONOUN_BEFORE_QUOTE =
  /\b(before|after|beside)\s+(he|she|they|it)$/i
const THE_WORD_BEFORE_QUOTE = /\bthe words?$/i
const DIALOGUE_VERB_BEFORE_QUOTE =
  /\b(say|says|said|whisper|whispers|murmur|murmurs|crackles|shouts|asks|mutters|calls)\s*,?\s*$/i
/** First-person attribution / action — stage direction, not out-loud speech. */
const FIRST_PERSON_DIRECTION =
  /^I\s+(?:echo|whisper|mutter|murmur|press|step|steps|draw|turn|look|glance|reach|kneel|crouch|straighten|shift|limp|gasps?|watches?|glances?)\b/i
/** First-person lines that are the spoken words, not physical staging. */
const FIRST_PERSON_SPOKEN =
  /^I\s+(?:did|do|don't|does|can|will|would|have|had|am|was|were|see|saw|think|thought|know|knew|said|say|tells?|told|mean|meant|need|want|gave|give|didn't|commanded|trust|see|saw)\b/i

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

/** Normalize curly/smart double quotes to straight `"` so quote scanners work. */
export function normalizeSmartQuotes(text: string): string {
  return text.replace(/[\u201c\u201d\u00ab\u00bb]/g, '"')
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
 *
 * Must NOT touch valid multi-beat lines (`"Speech." [action] "More."`) — those have a
 * real closer, and `rest` continues with `[` / whitespace, not the next speech opener.
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
  // In the mistaken Pyros form the "closer" is actually the next speech opener, so
  // rest continues with letters. Valid `"Speech." [action]...` continues with `[`.
  if (!/^\s*[A-Za-z]/.test(rest)) return trimmed
  if (indexOfSpokenQuoteFrom(rest, 0, false) < 0) return trimmed
  return trimmed.slice(1)
}

/**
 * Prep: `"Direction prose. 'Spoken line.'"` → `[Direction prose.] "Spoken line."`
 * (agents sometimes wrap the whole beat in outer doubles and put speech in singles).
 */
export function unwrapOuterQuoteWithInnerSingleSpeech(text: string): string {
  const trimmed = text.trim()
  if (!trimmed.startsWith('"') || !trimmed.endsWith('"')) return trimmed
  if (trimmed.length < 4) return trimmed
  const inner = trimmed.slice(1, -1)
  const match = inner.match(/^(.+?[.!?])\s+['\u2018](.+)['\u2019]\s*$/s)
  if (!match) return trimmed
  const direction = match[1].trim()
  const speech = match[2].trim()
  if (!direction || !speech) return trimmed
  if (direction.includes('"') || speech.includes('"')) return trimmed
  return `[${direction}] "${speech}"`
}

/**
 * Convert substantial `'speech'` / `‘speech’` outside [brackets] and outside
 * double quotes into `"speech"`. Skips apostrophes in words (`Sera's`).
 */
export function normalizeSingleQuotedSpeech(text: string): string {
  let result = ''
  let i = 0
  let bracketDepth = 0
  let inDoubleQuotes = false
  while (i < text.length) {
    const ch = text[i]
    if (ch === '[' ) {
      bracketDepth++
      result += ch
      i++
      continue
    }
    if (ch === ']' && bracketDepth > 0) {
      bracketDepth--
      result += ch
      i++
      continue
    }
    if (ch === '"' && bracketDepth === 0 && !isEscapedAt(text, i)) {
      inDoubleQuotes = !inDoubleQuotes
      result += ch
      i++
      continue
    }
    const isSingleOpener = ch === "'" || ch === '\u2018'
    if (!inDoubleQuotes && bracketDepth === 0 && isSingleOpener) {
      const closer = ch === '\u2018' ? '\u2019' : "'"
      // Apostrophe in a word (Sera's) — not speech.
      if (i > 0 && /[A-Za-z]/.test(text[i - 1])) {
        result += ch
        i++
        continue
      }
      let j = i + 1
      while (j < text.length) {
        if (text[j] === closer) {
          // Mid-word apostrophe (whatever's / Titan's) is not a closer.
          if (
            j > 0 &&
            j + 1 < text.length &&
            /[A-Za-z]/.test(text[j - 1]) &&
            /[A-Za-z]/.test(text[j + 1])
          ) {
            j++
            continue
          }
          break
        }
        j++
      }
      if (j < text.length) {
        const content = text.slice(i + 1, j)
        if (isSubstantialSpokenQuoteContent(content)) {
          result += `"${content}"`
          i = j + 1
          continue
        }
      }
    }
    result += ch
    i++
  }
  return result
}

/** True when bare prose is too small / garbage-like to wrap as stage direction. */
function isJunkBareProse(trimmed: string): boolean {
  if (!trimmed) return true
  if (/^[A-Z]$/.test(trimmed)) return true
  if (trimmed.length <= 2 && !/[a-z]/.test(trimmed)) return true
  return false
}

/**
 * Bare prose that is out-loud speech (not physical staging). Prefer quoting
 * these over bracketing — Class C used to wrap spoken tails like
 * `There. Did you hear that, forge-master?` in [brackets].
 */
export function looksLikeSpokenBareProse(trimmed: string): boolean {
  if (!trimmed) return false
  if (FIRST_PERSON_DIRECTION.test(trimmed)) return false
  // Attribution stays direction (gray), not spoken quotes.
  if (
    /^(he|she|they|it)\s+(says|said|whispers|whispered|mutters|asks|replies|answers)\b/i.test(
      trimmed,
    )
  ) {
    return false
  }
  // Third-person physical beat: "He tilts his head..." / "She turns away."
  if (/^(he|she|they)\s+[a-z]/i.test(trimmed) && !/\?\s*$/.test(trimmed)) {
    return false
  }

  // Clear speech signals win even when the line contains verbs like "run"/"steps"
  // used metaphorically ("how you run an empire", "patience runs thin").
  if (FIRST_PERSON_SPOKEN.test(trimmed)) return true
  if (/^I(?:'m|'ve|'ll|'d|’m|’ve|’ll|’d)\b/i.test(trimmed)) return true
  if (/^(you|you're|your|yours|you’re)\b/i.test(trimmed)) return true
  if (/\?\s*$/.test(trimmed)) return true
  if (/\byou understand\?\s*$/i.test(trimmed)) return true

  // Physical staging cues without a speech signal → direction.
  if (STAGE_ACTION_VERB.test(trimmed)) return false
  if (
    /\b(eyes?|gaze|hand|palm|fingers?|voice|body|lips?|tremor|floor|boots?|flickers?|scanning|crouches?|pressing|cybernetic)\b/i.test(
      trimmed,
    )
  ) {
    return false
  }

  // Complete sentence with no staging cues → speech.
  if (
    /[.!]\s*$/.test(trimmed) &&
    trimmed.split(/\s+/).filter(Boolean).length >= 4
  ) {
    return true
  }
  return false
}

/** Wrap bare prose as [direction] or "speech" depending on content. */
export function wrapBareProse(prose: string): string {
  const trimmed = prose.trim()
  if (!trimmed || isJunkBareProse(trimmed)) return prose
  const lead = prose.match(/^\s*/)?.[0] ?? ''
  const trail = prose.match(/\s*$/)?.[0] ?? ''
  if (looksLikeSpokenBareProse(trimmed)) {
    return `${lead}"${trimmed}"${trail}`
  }
  return `${lead}[${trimmed}]${trail}`
}

/** Full-line bare stage direction with no markers at all → wrap in [brackets]. */
export function wrapBareDirectionLine(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return text
  if (trimmed.includes('[') || trimmed.includes('"')) return text
  if (isJunkBareProse(trimmed)) return text
  if (looksLikeSpokenBareProse(trimmed)) {
    return `"${trimmed}"`
  }
  // Leave short bare utterances like "Hello there" alone — not safe to assume direction.
  const looksLikeDirection =
    STAGE_ACTION_VERB.test(trimmed) ||
    /\b(eyes?|gaze|hand|palm|fingers?|voice|body|lips?|tremor|floor|boots?)\b/i.test(trimmed) ||
    (!/[.!?]\s*$/.test(trimmed) && trimmed.length >= 24)
  if (!looksLikeDirection) return text
  return `[${trimmed}]`
}

/**
 * Strip trailing single-letter fragments agents leave after a complete line
 * (`..."standing on." P` or `..."yourself." [C]`).
 */
export function stripTrailingFragmentGarbage(text: string): string {
  return text
    .replace(/\s+\[[A-Z]\]\s*$/g, '')
    .replace(/\s+[A-Z]\s*$/g, '')
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
 * True when bracket content inside spoken quotes is emphasis / foreign phrase,
 * not a physical stage direction (`[my]`, `[sangue freddo]`).
 */
export function isSpokenEmphasisBracket(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed) return false
  if (isEmphasisBracket(trimmed)) return true
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length < 2 || words.length > 4) return false
  if (/[.!?]$/.test(trimmed)) return false
  if (STAGE_ACTION_VERB.test(trimmed)) return false
  if (trimmed.length > 40) return false
  return true
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

/**
 * Class E: reverse inverted speech-in-brackets mangling.
 * `[Speech.]" [action] "[More speech.]"` → `"Speech." [action] "More speech."`
 * Also handles `""More speech."` after the action.
 */
export function repairInvertedSpeechBrackets(text: string): string {
  const formBracketedSecond =
    /^\[([^\]]+)\]"\s*(\[[^\]]+\])\s*"\[([^\]]+)\]"?\s*$/s
  const mA = text.match(formBracketedSecond)
  if (mA) {
    return `"${mA[1].trim()}" ${mA[2].trim()} "${mA[3].trim()}"`
  }

  const formDoubleQuoteSecond =
    /^\[([^\]]+)\]"\s*(\[[^\]]+\])\s*""([^"]+)"\s*$/s
  const mB = text.match(formDoubleQuoteSecond)
  if (mB) {
    return `"${mB[1].trim()}" ${mB[2].trim()} "${mB[3].trim()}"`
  }

  const formQuotedSecond =
    /^\[([^\]]+)\]"\s*(\[[^\]]+\])\s*"([^"]+)"\s*$/s
  const mC = text.match(formQuotedSecond)
  if (mC) {
    return `"${mC[1].trim()}" ${mC[2].trim()} "${mC[3].trim()}"`
  }

  const twoPart = /^\[([^\]]+)\]"\s*(\[[^\]]+\])\s*$/s
  const m2 = text.match(twoPart)
  if (m2) {
    return `"${m2[1].trim()}" ${m2[2].trim()}`
  }

  // `"Speech.""" [action] "[More.]"` — opening quote + triple close + bracketed second.
  const formQuotedTripleBracketedSecond =
    /^"([^"]+?)"{2,}\s*(\[[^\]]+\])\s*"\[([^\]]+)\]"?\s*$/s
  const mQt = text.match(formQuotedTripleBracketedSecond)
  if (mQt) {
    return `"${mQt[1].trim()}" ${mQt[2].trim()} "${mQt[3].trim()}"`
  }

  // `"Speech.""" [action] "More."` — opening quote + triple close + normal second.
  const formQuotedTripleQuotedSecond =
    /^"([^"]+?)"{2,}\s*(\[[^\]]+\])\s*"([^"\[][^"]*)"\s*$/s
  const mQq = text.match(formQuotedTripleQuotedSecond)
  if (mQq) {
    return `"${mQq[1].trim()}" ${mQq[2].trim()} "${mQq[3].trim()}"`
  }

  const leadingBare =
    /^([^\[\]]+?)"{2,}\s*(\[[^\]]+\])\s*"\[([^\]]+)\]"?\s*$/s
  const m3 = text.match(leadingBare)
  if (m3) {
    const s1 = m3[1].trim().replace(/^["']+/, '').replace(/["']+$/, '')
    return `"${s1}" ${m3[2].trim()} "${m3[3].trim()}"`
  }

  return text
}

/**
 * Unwrap nested `["citation"]` / `['citation']` inside stage direction so cited
 * prop text stays as plain quotes in gray narration (not a nested bracket).
 */
export function unwrapNestedCitationBrackets(text: string): string {
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
    let inner = text.slice(i + 1, closeIdx)
    // Unwrap innermost [ "..." ] wrappers repeatedly.
    let prev = ''
    while (prev !== inner) {
      prev = inner
      inner = inner.replace(
        /\[\s*("([^"]*)"|'([^']*)'|\u201c([^\u201d]*)\u201d)\s*\]/g,
        '$1',
      )
    }
    result += `[${inner}]`
    i = closeIdx + 1
  }
  return result
}

/**
 * Class F: `"Speech. [action] More speech."` → `"Speech." [action] "More speech."`
 */
export function splitQuotesAroundInnerDirections(text: string): string {
  let result = ''
  let i = 0
  let bracketDepth = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === '[') {
      bracketDepth++
      result += ch
      i++
      continue
    }
    if (ch === ']' && bracketDepth > 0) {
      bracketDepth--
      result += ch
      i++
      continue
    }
    if (ch === '"' && bracketDepth === 0 && !isEscapedAt(text, i)) {
      const closeIdx = findCloseQuote(text, i)
      if (closeIdx < 0) {
        result += text.slice(i)
        break
      }
      const inner = text.slice(i + 1, closeIdx)
      if (!inner.includes('[')) {
        result += text.slice(i, closeIdx + 1)
        i = closeIdx + 1
        continue
      }
      let rebuilt = ''
      let pending = ''
      let j = 0
      const flushSpeech = () => {
        const t = pending.trim()
        if (!t) {
          pending = ''
          return
        }
        rebuilt += (rebuilt ? ' ' : '') + `"${t}"`
        pending = ''
      }
      while (j < inner.length) {
        if (inner[j] === '[') {
          flushSpeech()
          const bc = findCloseBracket(inner, j)
          if (bc < 0) {
            pending += inner.slice(j)
            break
          }
          rebuilt += (rebuilt ? ' ' : '') + inner.slice(j, bc + 1)
          j = bc + 1
          continue
        }
        pending += inner[j]
        j++
      }
      flushSpeech()
      result += rebuilt || text.slice(i, closeIdx + 1)
      i = closeIdx + 1
      continue
    }
    result += ch
    i++
  }
  return result
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

/** Drop an empty trailing spoken quote after balanced content (`[acts.] "`). */
export function stripEmptyTrailingQuote(text: string): string {
  if (!/\s+"\s*$/.test(text)) return text
  const trimmed = text.replace(/\s+"\s*$/, '')
  if (unclosedSpokenTail(trimmed) !== null) return text
  return trimmed
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
      isSpokenEmphasisBracket(content) ? content.trim() : match,
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
  /** Class E: reversed inverted speech-in-brackets mangling. */
  classE: boolean
  /** Class C: wrapped unbracketed stage direction before spoken quotes. */
  classC: boolean
  /** Class A: quotes were trapped inside an outer [bracket] block. */
  classA: boolean
  /** Class B: short emphasis [word(s)] inside quotes was unwrapped. */
  classB: boolean
  /** Class F: split spoken quotes around inner [stage direction]. */
  classF: boolean
  /** Class D: balanced or trimmed stray closing quotes / trailing junk. */
  classD: boolean
}

/** Run repair steps and report which class(es) changed the line. */
export function analyzeDialogueRepair(text: string): DialogueRepairAnalysis {
  const stripped = stripAgentToolLeakage(text)
  const smart = normalizeSmartQuotes(stripped)
  const escaped = normalizeStoredQuoteEscapes(smart)
  const unwrappedOuter = unwrapOuterDialogueQuotes(escaped)
  const unwrappedSingle = unwrapOuterQuoteWithInnerSingleSpeech(unwrappedOuter)
  const normalizedSingles = normalizeSingleQuotedSpeech(unwrappedSingle)
  const unwrapped = unwrapMistakenLeadingQuote(normalizedSingles)
  const normalized = normalizeStageDirectionMarkers(unwrapped)
  const afterE = repairInvertedSpeechBrackets(normalized)
  const afterFixDouble = fixDoubleClosedDirectionBeforeQuote(afterE)
  const afterC = wrapUnbracketedDirectionBeforeQuotes(afterFixDouble)
  const afterBare = wrapBareDirectionLine(afterC)
  const afterCite = unwrapNestedCitationBrackets(afterBare)
  const afterEmphasisDirs = unwrapEmphasisBracketsInDirections(afterCite)
  const afterA = closeBracketBeforeQuotes(afterEmphasisDirs)
  const afterB = unwrapEmphasisBracketsInQuotes(afterA)
  const afterF = splitQuotesAroundInnerDirections(afterB)
  const afterJunk = stripTrailingFragmentGarbage(afterF)
  const afterEmpty = stripEmptyTrailingQuote(afterJunk)
  const afterD = normalizeDialogueQuotes(afterEmpty)
  return {
    after: afterD,
    prep:
      stripped !== text ||
      smart !== stripped ||
      escaped !== smart ||
      unwrappedOuter !== escaped ||
      unwrappedSingle !== unwrappedOuter ||
      normalizedSingles !== unwrappedSingle ||
      unwrapped !== normalizedSingles,
    classE: afterE !== normalized,
    classC:
      afterC !== afterFixDouble ||
      afterFixDouble !== afterE ||
      afterBare !== afterC,
    classA: afterA !== afterEmphasisDirs,
    classB:
      afterB !== afterA ||
      afterEmphasisDirs !== afterCite ||
      afterCite !== afterBare,
    classF: afterF !== afterB,
    classD:
      afterD !== afterEmpty ||
      afterEmpty !== afterJunk ||
      afterJunk !== afterF,
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
  'Format every line as [physical action] "spoken words". ' +
  'Correct: [glances at the door] "We should leave." ' +
  'Multi-beat: "First." [turns] "Second." — close quotes before each [action], reopen after. ' +
  'Every line must start with [ or ". Never leave bare narration without brackets. ' +
  'Never wrap spoken words in [brackets] (wrong: [We should leave.] → right: "We should leave."). ' +
  'Never put [brackets] around words inside quotes ' +
  '(write "it is listening" / "my mask" / "sangue freddo", not "it is [listening]" / "[my] mask"). ' +
  'Never leave stage direction inside spoken quotes ' +
  '(wrong: "Hello. [nods] More." → right: "Hello." [nods] "More."). ' +
  'Never invent trailing junk like [P] or [C] after a finished line. ' +
  'Cited text on props stays as plain quotes inside narration ' +
  '(write [reads the words "The priest\'s real name."], not [["The priest\'s real name."]]). ' +
  'Do not use *asterisks*. Output only the line text — never prefix with tool names like etc_emote or etc_speak.'

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
