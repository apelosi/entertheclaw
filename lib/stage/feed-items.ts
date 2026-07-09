import {
  normalizeEmoteAction,
  normalizeStageDirectionMarkers,
} from '@/lib/stage/dialogue-format'

export type FeedItem =
  | {
      kind: 'dialogue'
      id: string
      speakerName: string
      text: string
      isEmote?: boolean
      speakerImageUrl?: string | null
      agentId?: string | null
      isOwn?: boolean
      createdAt: number
    }
  | {
      kind: 'twist'
      id: string
      text: string
      userDisplayName: string
      isOwn?: boolean
      createdAt: number
    }
  | {
      kind: 'scene'
      id: string
      name: string
      description: string
      reason?: string
      createdAt: number
    }
  | {
      kind: 'cast'
      id: string
      action: 'joined' | 'left'
      agentName: string
      createdAt: number
    }

export interface StageEventLike {
  id: string
  type: string
  content: unknown
  createdAt: Date | string | null
  agentId?: string | null
  /** Server-computed ownership flag (the /feed endpoint sets it). */
  isOwn?: boolean
}

export function dialogueFromEventContent(
  content: unknown,
): { text: string; speakerName: string } | null {
  if (typeof content !== 'object' || content === null) return null
  const c = content as Record<string, unknown>
  if (typeof c.text !== 'string' || typeof c.speakerName !== 'string') return null
  return { text: c.text, speakerName: c.speakerName }
}

export function parseFeedItem(event: StageEventLike): FeedItem | null {
  if (
    event.type !== 'dialogue' &&
    event.type !== 'twist' &&
    event.type !== 'scene_change' &&
    event.type !== 'joined' &&
    event.type !== 'left'
  ) {
    return null
  }
  if (typeof event.content !== 'object' || event.content === null) return null

  const createdAt = event.createdAt ? new Date(event.createdAt).getTime() : Date.now()
  const c = event.content as Record<string, unknown>

  if (event.type === 'dialogue') {
    if (typeof c.text !== 'string' || typeof c.speakerName !== 'string') return null
    return {
      kind: 'dialogue',
      id: event.id,
      speakerName: c.speakerName,
      text: c.text,
      isEmote: c.isEmote === true,
      agentId: event.agentId ?? null,
      ...(event.isOwn ? { isOwn: true as const } : {}),
      createdAt,
    }
  }

  if (event.type === 'joined' || event.type === 'left') {
    return {
      kind: 'cast',
      id: event.id,
      action: event.type,
      agentName: typeof c.agentName === 'string' ? c.agentName : 'A performer',
      createdAt,
    }
  }

  if (event.type === 'scene_change') {
    if (typeof c.name !== 'string' || typeof c.description !== 'string') return null
    return {
      kind: 'scene',
      id: event.id,
      name: c.name,
      description: c.description,
      reason: typeof c.reason === 'string' ? c.reason : undefined,
      createdAt,
    }
  }

  if (typeof c.text !== 'string') return null
  return {
    kind: 'twist',
    id: event.id,
    text: c.text,
    userDisplayName:
      typeof c.userDisplayName === 'string' ? c.userDisplayName : 'Anonymous Director',
    ...(event.isOwn ? { isOwn: true as const } : {}),
    createdAt,
  }
}

export function feedItemsFromEvents(events: StageEventLike[]): FeedItem[] {
  return events
    .map(parseFeedItem)
    .filter((item): item is FeedItem => item !== null)
    .sort((a, b) => b.createdAt - a.createdAt)
}

/** Total dialogue lines visible in the script panel (current + prior). */
export const RECENT_SCRIPT_DIALOGUE_TOTAL_DESKTOP = 5
export const RECENT_SCRIPT_DIALOGUE_TOTAL_MOBILE = 3

/** Prior dialogue lines plus any scenes/twists within that same time window. */
export function selectRecentScriptPreview(
  feedItems: FeedItem[],
  excludeId: string | undefined,
  totalDialogueLimit: number,
): FeedItem[] {
  if (totalDialogueLimit <= 0) return []

  const priorDialogueLimit = excludeId
    ? Math.max(0, totalDialogueLimit - 1)
    : totalDialogueLimit
  if (priorDialogueLimit <= 0) return []

  const filtered = feedItems.filter((i) => i.id !== excludeId)
  const dialogues = filtered.filter((i) => i.kind === 'dialogue')
  if (dialogues.length === 0) return []

  const cutoffIndex = Math.min(priorDialogueLimit, dialogues.length) - 1
  const cutoffTime = dialogues[cutoffIndex]!.createdAt

  return filtered.filter((i) => i.createdAt >= cutoffTime)
}

export function formatFeedAsMarkdown(
  items: FeedItem[],
  stageName: string,
): string {
  const lines = [`# ${stageName} — Script History`, '']
  for (const item of items) {
    const time = new Date(item.createdAt).toISOString()
    if (item.kind === 'dialogue') {
      const body = item.isEmote
        ? `[${normalizeEmoteAction(item.text)}]`
        : normalizeStageDirectionMarkers(item.text)
      lines.push(`## ${item.speakerName}`, `_${time}_`, '', body, '')
    } else if (item.kind === 'scene') {
      lines.push(`## Scene — ${item.name}`, `_${time}_`, '', item.description, '')
    } else if (item.kind === 'cast') {
      const verb = item.action === 'joined' ? 'joined' : 'left'
      lines.push(`## ${item.agentName} ${verb} the stage`, `_${time}_`, '')
    } else {
      lines.push(`## Twist — ${item.userDisplayName}`, `_${time}_`, '', `> ${item.text}`, '')
    }
  }
  return lines.join('\n').trimEnd() + '\n'
}
