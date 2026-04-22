'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'

interface Participant {
  participantId: string
  role: string
  agentId: string
  characterName: string | null
  characterOccupation: string | null
  characterImageUrl: string | null
  characterSpriteUrl: string | null
}

interface StageEvent {
  id: string
  type: string
  agentId: string | null
  characterId: string | null
  content: unknown
  createdAt: Date | string | null
}

interface DialogueLine {
  speakerName: string
  text: string
  timestamp: number
}

interface StageCanvasProps {
  stageId: string
  stageName: string
  stageTheme: string
  participants: Participant[]
  initialEvents: StageEvent[]
}

export default function StageCanvas({
  stageId,
  stageName,
  stageTheme,
  participants,
  initialEvents,
}: StageCanvasProps) {
  const gameRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const [currentDialogue, setCurrentDialogue] = useState<DialogueLine | null>(null)
  const [displayedText, setDisplayedText] = useState('')
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [isBackVisible, setIsBackVisible] = useState(true)

  // Typewriter effect
  const showDialogue = useCallback((speaker: string, text: string) => {
    if (typewriterRef.current) clearInterval(typewriterRef.current)
    setCurrentDialogue({ speakerName: speaker, text, timestamp: Date.now() })
    setDisplayedText('')
    let i = 0
    typewriterRef.current = setInterval(() => {
      i++
      setDisplayedText(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(typewriterRef.current!)
        typewriterRef.current = null
      }
    }, 40)
  }, [])

  // Seed initial dialogue from most recent dialogue event
  useEffect(() => {
    const lastDialogue = initialEvents.find((e) => e.type === 'dialogue')
    if (lastDialogue && typeof lastDialogue.content === 'object' && lastDialogue.content !== null) {
      const c = lastDialogue.content as Record<string, unknown>
      if (typeof c.text === 'string' && typeof c.speakerName === 'string') {
        showDialogue(c.speakerName, c.text)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // SSE subscription
  useEffect(() => {
    const es = new EventSource(`/api/v1/stages/${stageId}/events`)
    eventSourceRef.current = es

    es.addEventListener('dialogue', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { speakerName?: string; text?: string }
        if (data.speakerName && data.text) {
          showDialogue(data.speakerName, data.text)
        }
      } catch {}
    })

    es.onerror = () => {
      // Will auto-reconnect via browser
    }

    return () => {
      es.close()
      if (typewriterRef.current) clearInterval(typewriterRef.current)
    }
  }, [stageId, showDialogue])

  // Lazy-load Phaser
  useEffect(() => {
    if (!gameRef.current) return

    let game: import('phaser').Game | null = null

    async function initPhaser() {
      const Phaser = (await import('phaser')).default

      class StageScene extends Phaser.Scene {
        constructor() {
          super({ key: 'StageScene' })
        }

        create() {
          const { width, height } = this.scale

          // Dark stage floor grid
          const graphics = this.add.graphics()
          graphics.lineStyle(1, 0x242424, 0.6)

          for (let x = 0; x < width; x += 48) {
            graphics.moveTo(x, 0)
            graphics.lineTo(x, height)
          }
          for (let y = 0; y < height; y += 48) {
            graphics.moveTo(0, y)
            graphics.lineTo(width, y)
          }
          graphics.strokePath()

          // Stage name watermark
          this.add
            .text(width / 2, height / 2, stageName, {
              fontFamily: 'Georgia, serif',
              fontSize: '48px',
              color: '#1E1E1E',
            })
            .setOrigin(0.5)
            .setAlpha(0.5)

          // Placeholder sprites for participants
          participants.forEach((p, i) => {
            const x = 80 + (i % 8) * 120
            const y = 120 + Math.floor(i / 8) * 120
            const color = p.role === 'main' ? 0xc41e3a : 0x444440

            const sprite = this.add.rectangle(x, y, 32, 48, color, 0.8)
            const label = this.add
              .text(x, y + 30, p.characterName ?? '?', {
                fontFamily: 'monospace',
                fontSize: '10px',
                color: '#888880',
              })
              .setOrigin(0.5, 0)
          })
        }
      }

      const config: import('phaser').Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: gameRef.current!,
        width: gameRef.current!.offsetWidth,
        height: gameRef.current!.offsetHeight,
        backgroundColor: '#111111',
        scene: StageScene,
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        audio: { noAudio: true },
      }

      game = new Phaser.Game(config)
    }

    initPhaser()

    return () => {
      game?.destroy(true)
    }
  }, [stageId, stageName, participants])

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#111111]">
      {/* Phaser canvas container */}
      <div ref={gameRef} className="absolute inset-0" />

      {/* Back navigation — fades after a moment */}
      <div
        className="absolute left-4 top-4 z-10 transition-opacity duration-300"
        style={{ opacity: isBackVisible ? 1 : 0 }}
      >
        <Link
          href="/"
          className="flex h-9 items-center gap-2 rounded border border-[#3A3A3A] bg-[#080808]/80 px-3 text-xs text-[#888880] backdrop-blur-sm transition-colors hover:text-[#F0EDE8]"
        >
          ← Exit Stage
        </Link>
      </div>

      {/* Stage name badge */}
      <div className="absolute right-4 top-4 z-10">
        <div className="flex items-center gap-2 rounded border border-[#242424] bg-[#080808]/80 px-3 py-2 backdrop-blur-sm">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#C41E3A] animate-pulse-live" />
          <span
            className="font-display text-sm font-semibold tracking-[-0.01em] text-[#F0EDE8]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {stageName}
          </span>
        </div>
      </div>

      {/* RPG Dialogue Box */}
      <div className="absolute bottom-0 left-0 right-0 z-20 border-x-0 border-b-0 border-t border-[#C41E3A] bg-[#0D0D0D]">
        <div className="px-5 py-4">
          {currentDialogue ? (
            <>
              <p className="mb-2 font-ui text-[11px] font-semibold uppercase tracking-[0.1em] text-[#E8405A]">
                {currentDialogue.speakerName}
              </p>
              <p className="min-h-[3rem] font-mono text-[12px] leading-relaxed text-[#F0EDE8]">
                {displayedText}
                <span className="animate-pulse-live">█</span>
              </p>
            </>
          ) : (
            <p className="font-mono text-[12px] text-[#444440]">
              Waiting for the stage to speak…
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
