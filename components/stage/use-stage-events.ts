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

export interface SceneChangeContent {
  name: string
  description: string
  reason?: string
  sourceEventId?: string
  sourceType?: 'dialogue' | 'twist'
}

interface Handlers {
  onDialogue?: (data: DialogueContent, raw: SSEEvent<DialogueContent>) => void
  onTwist?: (data: TwistContent, raw: SSEEvent<TwistContent>) => void
  onJoined?: (data: JoinedContent, raw: SSEEvent<JoinedContent>) => void
  onCharacterReady?: (data: CharacterReadyContent, raw: SSEEvent<CharacterReadyContent>) => void
  onSceneChange?: (data: SceneChangeContent, raw: SSEEvent<SceneChangeContent>) => void
}

/**
 * Subscribe to a stage's SSE stream.
 * Handlers are read-via-ref so callers can swap closures freely.
 * While the document is hidden, the EventSource is closed so the server stops
 * polling Postgres (Neon compute cost — VV-20).
 */
export function useStageEvents(stageId: string, handlers: Handlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    let es: EventSource | null = null

    function bind<T>(source: EventSource, name: string, fn: (data: T, raw: SSEEvent<T>) => void) {
      source.addEventListener(name, (e: MessageEvent) => {
        try {
          const raw = JSON.parse(e.data) as SSEEvent<T>
          const content = (raw?.content ?? raw) as T
          fn(content, raw)
        } catch {
          // malformed event payload; skip
        }
      })
    }

    function connect() {
      if (es) return
      es = new EventSource(`/api/v1/stages/${stageId}/events`)
      bind<DialogueContent>(es, 'dialogue', (data, raw) =>
        handlersRef.current.onDialogue?.(data, raw),
      )
      bind<TwistContent>(es, 'twist', (data, raw) =>
        handlersRef.current.onTwist?.(data, raw),
      )
      bind<JoinedContent>(es, 'joined', (data, raw) =>
        handlersRef.current.onJoined?.(data, raw),
      )
      bind<CharacterReadyContent>(es, 'character_ready', (data, raw) =>
        handlersRef.current.onCharacterReady?.(data, raw),
      )
      bind<SceneChangeContent>(es, 'scene_change', (data, raw) =>
        handlersRef.current.onSceneChange?.(data, raw),
      )
      es.onerror = () => {
        // EventSource auto-reconnects while open; nothing to do.
      }
    }

    function disconnect() {
      if (!es) return
      es.close()
      es = null
    }

    function syncVisibility() {
      if (typeof document !== 'undefined' && document.hidden) {
        disconnect()
      } else {
        connect()
      }
    }

    syncVisibility()
    document.addEventListener('visibilitychange', syncVisibility)

    return () => {
      document.removeEventListener('visibilitychange', syncVisibility)
      disconnect()
    }
  }, [stageId])
}
