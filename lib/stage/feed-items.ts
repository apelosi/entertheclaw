import {
  emoteContainsDialogue,
  normalizeEmoteAction,
  repairDialogueFormatting,
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
      /** Server-enriched (enrichCastEvents); may be absent for a live event. */
      characterName?: string | null
      ownerName?: string | null
      agentId?: string | null
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
  /** Server-enriched cast fields (enrichCastEvents sets these on joined/left). */
  characterName?: string | null
  agentName?: string | null
  ownerName?: string | null
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
    const rawText = c.text
    const isEmote = c.isEmote === true && !emoteContainsDialogue(rawText)
    return {
      kind: 'dialogue',
      id: event.id,
      speakerName: c.speakerName,
      text: isEmote ? normalizeEmoteAction(rawText) : repairDialogueFormatting(rawText),
      isEmote,
      agentId: event.agentId ?? null,
      ...(event.isOwn ? { isOwn: true as const } : {}),
      createdAt,
    }
  }

  if (event.type === 'joined' || event.type === 'left') {
    const agentName =
      (typeof event.agentName === 'string' ? event.agentName : null) ??
      (typeof c.agentName === 'string' ? c.agentName : null) ??
      'A performer'
    return {
      kind: 'cast',
      id: event.id,
      action: event.type,
      agentName,
      agentId: event.agentId ?? null,
      characterName: event.characterName ?? null,
      ownerName: event.ownerName ?? null,
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

/** Primary label for a cast row: the character name, falling back to the agent. */
export function castHeadline(item: FeedItem & { kind: 'cast' }): string {
  return item.characterName || item.agentName
}

/** Secondary label: agent (when a character name led) and owner. */
export function castSubline(item: FeedItem & { kind: 'cast' }): string | null {
  const parts: string[] = []
  if (item.characterName && item.agentName) parts.push(item.agentName)
  if (item.ownerName) parts.push(`owned by ${item.ownerName}`)
  return parts.length ? parts.join(' · ') : null
}

export function feedItemsFromEvents(events: StageEventLike[]): FeedItem[] {
  return events
    .map(parseFeedItem)
    .filter((item): item is FeedItem => item !== null)
    .sort((a, b) => b.createdAt - a.createdAt)
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
        : repairDialogueFormatting(item.text)
      lines.push(`## ${item.speakerName}`, `_${time}_`, '', body, '')
    } else if (item.kind === 'scene') {
      lines.push(`## Scene — ${item.name}`, `_${time}_`, '', item.description, '')
    } else if (item.kind === 'cast') {
      const verb = item.action === 'joined' ? 'joined' : 'left'
      const sub = castSubline(item)
      lines.push(
        `## ${castHeadline(item)} ${verb} the stage`,
        `_${time}_`,
        ...(sub ? ['', sub] : []),
        '',
      )
    } else {
      lines.push(`## Twist — ${item.userDisplayName}`, `_${time}_`, '', `> ${item.text}`, '')
    }
  }
  return lines.join('\n').trimEnd() + '\n'
}
