import { repairDialogueFormatting, splitDialogueSegments } from '@/lib/stage/dialogue-format'
import { cn } from '@/lib/utils'

interface Props {
  text: string
  className?: string
  directionClassName?: string
  /** When set (typewriter), style from the full line but only render this many chars. */
  visibleLength?: number
}

/** Renders dialogue with [bracketed] stage directions styled separately from spoken text. */
export function DialogueText({
  text,
  className,
  directionClassName,
  visibleLength,
}: Props) {
  const normalized = repairDialogueFormatting(text)
  const limit = visibleLength ?? normalized.length
  const segments = splitDialogueSegments(normalized)

  if (segments.length === 1 && segments[0].kind === 'spoken' && limit >= normalized.length) {
    return <span className={className}>{normalized.slice(0, limit)}</span>
  }

  const parts: React.ReactNode[] = []
  let pos = 0

  for (let i = 0; i < segments.length; i++) {
    if (pos >= limit) break
    const seg = segments[i]
    if (seg.kind === 'direction') {
      const full = `[${seg.content}]`
      const take = Math.min(full.length, limit - pos)
      if (take > 0) {
        parts.push(
          <span key={i} className={cn('text-[#888880]', directionClassName)}>
            {full.slice(0, take)}
          </span>,
        )
        pos += take
      }
    } else {
      const take = Math.min(seg.text.length, limit - pos)
      if (take > 0) {
        parts.push(<span key={i}>{seg.text.slice(0, take)}</span>)
        pos += take
      }
    }
  }

  return <span className={className}>{parts}</span>
}
