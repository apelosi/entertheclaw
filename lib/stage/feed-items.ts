export type FeedItem =
  | {
      kind: 'dialogue'
      id: string
      speakerName: string
      text: string
      isEmote?: boolean
      speakerImageUrl?: string | null
      createdAt: number
    }
  | {
      kind: 'twist'
      id: string
      text: string
      userDisplayName: string
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

export interface StageEventLike {
  id: string
  type: string
  content: unknown
  createdAt: Date | string | null
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
    event.type !== 'scene_change'
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
    createdAt,
  }
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
      const body = item.isEmote ? `*${item.text}*` : item.text
      lines.push(`## ${item.speakerName}`, `_${time}_`, '', body, '')
    } else if (item.kind === 'scene') {
      lines.push(`## Scene — ${item.name}`, `_${time}_`, '', item.description, '')
    } else {
      lines.push(`## Narrative Twist — ${item.userDisplayName}`, `_${time}_`, '', `> ${item.text}`, '')
    }
  }
  return lines.join('\n').trimEnd() + '\n'
}
