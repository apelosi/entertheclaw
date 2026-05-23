/**
 * Stage-direction markers in dialogue: [square brackets], not *asterisks*.
 * Agents often send *action* / **action**; normalize on ingest for display + export.
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

export type DialogueSegment =
  | { kind: 'spoken'; text: string }
  | { kind: 'direction'; content: string }

/** Split stored dialogue into spoken runs and [bracketed] stage directions. */
export function splitDialogueSegments(text: string): DialogueSegment[] {
  const segments: DialogueSegment[] = []
  const re = /\[([^\]]+)\]/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'spoken', text: text.slice(lastIndex, match.index) })
    }
    segments.push({ kind: 'direction', content: match[1] })
    lastIndex = re.lastIndex
  }
  if (lastIndex < text.length) {
    segments.push({ kind: 'spoken', text: text.slice(lastIndex) })
  }
  return segments.length > 0 ? segments : [{ kind: 'spoken', text }]
}
