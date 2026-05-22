'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { DramatisPersonae, type DramatisCharacter } from './dramatis-personae'
import { InterventionTerminal } from './intervention-terminal'
import { Scriptorium, type CurrentDialogue } from './scriptorium'
import { CharacterOnStage, layoutPositions, type OnStageCharacter } from './character-on-stage'
import { TwistBanner, type TwistAnnouncement } from './twist-banner'
import { useStageEvents } from './use-stage-events'

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

interface StageCanvasProps {
  stageId: string
  stageName: string
  stageTheme: string
  stageImageUrl: string | null
  participants: Participant[]
  initialEvents: StageEvent[]
  isLoggedIn: boolean
  lastTwistAt: number | null
  lastUserTwistAt: number | null
}

const TYPEWRITER_INTERVAL_MS = 35

export default function StageCanvas({
  stageId,
  stageName,
  stageImageUrl,
  participants,
  initialEvents,
  isLoggedIn,
  lastTwistAt,
  lastUserTwistAt,
}: StageCanvasProps) {
  const router = useRouter()
  const [dialogue, setDialogue] = useState<CurrentDialogue | null>(null)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [twist, setTwist] = useState<TwistAnnouncement | null>(null)
  const [liveLastTwistAt, setLiveLastTwistAt] = useState<number | null>(lastTwistAt)
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const participantBySpeakerName = useMemo(() => {
    const map = new Map<string, Participant>()
    for (const p of participants) {
      if (p.characterName) map.set(p.characterName, p)
    }
    return map
  }, [participants])

  const participantByAgentId = useMemo(() => {
    const map = new Map<string, Participant>()
    for (const p of participants) map.set(p.agentId, p)
    return map
  }, [participants])

  const showDialogue = useCallback(
    (speakerName: string, text: string, opts?: { agentId?: string | null; isEmote?: boolean }) => {
      if (typewriterRef.current) {
        clearInterval(typewriterRef.current)
        typewriterRef.current = null
      }

      const matchedByName = participantBySpeakerName.get(speakerName)
      const matchedByAgent = opts?.agentId ? participantByAgentId.get(opts.agentId) : null
      const speaker = matchedByAgent ?? matchedByName ?? null

      setActiveAgentId(speaker?.agentId ?? opts?.agentId ?? null)
      const logEntry = Math.abs(hashString(`${speakerName}:${text}`)) % 9999

      setDialogue({
        speakerName,
        text,
        displayedText: '',
        isEmote: opts?.isEmote,
        speakerImageUrl: speaker?.characterImageUrl ?? null,
        logEntry,
      })

      let i = 0
      typewriterRef.current = setInterval(() => {
        i++
        setDialogue((current) =>
          current && current.text === text
            ? { ...current, displayedText: text.slice(0, i) }
            : current
        )
        if (i >= text.length) {
          if (typewriterRef.current) clearInterval(typewriterRef.current)
          typewriterRef.current = null
        }
      }, TYPEWRITER_INTERVAL_MS)
    },
    [participantBySpeakerName, participantByAgentId]
  )

  // Seed dialogue from most recent dialogue event in initial fetch
  useEffect(() => {
    const lastDialogue = initialEvents.find((e) => e.type === 'dialogue')
    if (!lastDialogue || typeof lastDialogue.content !== 'object' || lastDialogue.content === null) {
      return
    }
    const c = lastDialogue.content as Record<string, unknown>
    if (typeof c.text === 'string' && typeof c.speakerName === 'string') {
      showDialogue(c.speakerName, c.text, {
        agentId: lastDialogue.agentId,
        isEmote: c.isEmote === true,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useStageEvents(stageId, {
    onDialogue: (data, raw) => {
      if (!data?.text || !data?.speakerName) return
      showDialogue(data.speakerName, data.text, {
        agentId: raw.agentId,
        isEmote: data.isEmote,
      })
    },
    onTwist: (data, raw) => {
      const createdAt = raw.createdAt ? new Date(raw.createdAt).getTime() : Date.now()
      setLiveLastTwistAt(createdAt)
      if (data?.text) {
        setTwist({
          id: raw.id,
          text: data.text,
          userDisplayName: data.userDisplayName ?? 'Anonymous Director',
          receivedAt: Date.now(),
        })
      }
    },
    onCharacterReady: () => {
      // Bible + portrait + sprite landed for some character. Re-fetch
      // participants so the new portrait shows up everywhere.
      router.refresh()
    },
    onJoined: () => {
      // New agent on stage — refresh so the new slot/character shows up.
      router.refresh()
    },
  })

  useEffect(() => {
    return () => {
      if (typewriterRef.current) clearInterval(typewriterRef.current)
    }
  }, [])

  const onStageChars: OnStageCharacter[] = useMemo(
    () =>
      participants.map((p) => ({
        participantId: p.participantId,
        agentId: p.agentId,
        role: p.role,
        characterName: p.characterName,
        characterImageUrl: p.characterImageUrl,
        characterSpriteUrl: p.characterSpriteUrl,
      })),
    [participants]
  )

  const positions = useMemo(() => layoutPositions(onStageChars), [onStageChars])

  const mainCharacters: DramatisCharacter[] = useMemo(
    () =>
      participants
        .filter((p) => p.role === 'main')
        .map((p) => ({
          participantId: p.participantId,
          agentId: p.agentId,
          role: p.role,
          characterName: p.characterName,
          characterImageUrl: p.characterImageUrl,
        })),
    [participants]
  )

  return (
    <main className="relative flex-1 overflow-hidden bg-[#0e0e0e]">
      {/* Stage background */}
      <div className="absolute inset-0">
        {stageImageUrl ? (
          <Image
            src={stageImageUrl}
            alt={`${stageName} backdrop`}
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-50 image-pixelated"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a0a14] via-[#0e0e0e] to-[#080808]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-[#080808]/60" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_30%,_#080808_85%)]" />
      </div>

      {/* Circular stage area + sprite positions */}
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        <div className="relative h-[min(90vw,800px)] w-[min(90vw,800px)] max-w-[800px] max-h-[800px] rounded-full border border-white/5 bg-[#0e0e0e]/20 shadow-[0_0_120px_rgba(196,30,58,0.1)]">
          {/* Subtle grid floor */}
          <div className="absolute inset-0 rounded-full bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] opacity-30" />
          {/* Focal point */}
          <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#C41E3A]/40 bg-[#C41E3A]/15 animate-pulse-live" />

          {positions.map(({ character, x, y }) => (
            <CharacterOnStage
              key={character.participantId}
              character={character}
              x={x}
              y={y}
              isActive={character.agentId === activeAgentId}
            />
          ))}
        </div>
      </div>

      {/* Twist banner */}
      <TwistBanner twist={twist} />

      {/* HUDs */}
      <div className="pointer-events-none absolute left-6 top-6 z-20">
        <DramatisPersonae mainCharacters={mainCharacters} activeAgentId={activeAgentId} />
      </div>

      <div className="pointer-events-none absolute right-6 top-6 z-20">
        <InterventionTerminal
          stageId={stageId}
          isLoggedIn={isLoggedIn}
          lastTwistAt={lastTwistAt}
          lastUserTwistAt={lastUserTwistAt}
          liveLastTwistAt={liveLastTwistAt}
          onLocalSubmitSuccess={() => setLiveLastTwistAt(Date.now())}
        />
      </div>

      <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 w-11/12 -translate-x-1/2 max-w-3xl">
        <Scriptorium dialogue={dialogue} />
      </div>

      {/* Exit affordance — small footnote-style link, in case nav isn't enough */}
      <div className="pointer-events-auto absolute bottom-2 left-3 z-20">
        <Link
          href="/"
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#444440] transition-colors hover:text-[#888880]"
        >
          ← exit stage
        </Link>
      </div>
    </main>
  )
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return h
}
