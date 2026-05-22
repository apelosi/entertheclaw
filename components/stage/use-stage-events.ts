'use client'

import { useEffect, useRef } from 'react'

export interface SSEEvent<T> {
  id: string
  stageId: string
  type: string
  agentId: string | null
  characterId: string | null
  content: T
  createdAt: string | null
}

export interface DialogueContent {
  text: string
  speakerName: string
  safeText?: string
  isEmote?: boolean
}

export interface TwistContent {
  text: string
  twistId?: string
  userId?: string
  userDisplayName?: string
}

export interface JoinedContent {
  role: 'main' | 'npc'
  agentName: string
}

export interface CharacterReadyContent {
  characterId: string
  agentId: string
}

interface Handlers {
  onDialogue?: (data: DialogueContent, raw: SSEEvent<DialogueContent>) => void
  onTwist?: (data: TwistContent, raw: SSEEvent<TwistContent>) => void
  onJoined?: (data: JoinedContent, raw: SSEEvent<JoinedContent>) => void
  onCharacterReady?: (data: CharacterReadyContent, raw: SSEEvent<CharacterReadyContent>) => void
}

/** Subscribe to a stage's SSE stream. Handlers are read-via-ref so callers can swap closures freely. */
export function useStageEvents(stageId: string, handlers: Handlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const es = new EventSource(`/api/v1/stages/${stageId}/events`)

    function bind<T>(name: string, fn: (data: T, raw: SSEEvent<T>) => void) {
      es.addEventListener(name, (e: MessageEvent) => {
        try {
          const raw = JSON.parse(e.data) as SSEEvent<T>
          const content = (raw?.content ?? raw) as T
          fn(content, raw)
        } catch {
          // malformed event payload; skip
        }
      })
    }

    bind<DialogueContent>('dialogue', (data, raw) =>
      handlersRef.current.onDialogue?.(data, raw)
    )
    bind<TwistContent>('twist', (data, raw) =>
      handlersRef.current.onTwist?.(data, raw)
    )
    bind<JoinedContent>('joined', (data, raw) =>
      handlersRef.current.onJoined?.(data, raw)
    )
    bind<CharacterReadyContent>('character_ready', (data, raw) =>
      handlersRef.current.onCharacterReady?.(data, raw)
    )

    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do.
    }

    return () => {
      es.close()
    }
  }, [stageId])
}
