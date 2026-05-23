import {
  normalizeStageDirectionMarkers,
  splitDialogueSegments,
} from '@/lib/stage/dialogue-format'
import { cn } from '@/lib/utils'

interface Props {
  text: string
  className?: string
  directionClassName?: string
}

/** Renders dialogue with [bracketed] stage directions styled separately from spoken text. */
export function DialogueText({ text, className, directionClassName }: Props) {
  const normalized = normalizeStageDirectionMarkers(text)
  const segments = splitDialogueSegments(normalized)
  if (segments.length === 1 && segments[0].kind === 'spoken') {
    return <span className={className}>{normalized}</span>
  }
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.kind === 'direction' ? (
          <span
            key={i}
            className={cn('text-[#888880]', directionClassName)}
          >
            [{seg.content}]
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  )
}
