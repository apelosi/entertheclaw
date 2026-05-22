'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { CharactersRail, type RailCharacter } from './characters-rail'
import { NarrativeTwist } from './narrative-twist'
import { DialoguePanel, type CurrentDialogue } from './dialogue-panel'
import { CharacterOnStage, layoutPositions, type OnStageCharacter } from './character-on-stage'
import { TwistBanner, type TwistAnnouncement } from './twist-banner'
import { useStageEvents } from './use-stage-events'

interface Participant {
  participantId: string
  role: string
  agentId: string
  agentUserId: string | null
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
  currentUserId: string | null
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
  currentUserId,
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

  const isMine = useCallback(
    (agentUserId: string | null) =>
      Boolean(currentUserId) && agentUserId === currentUserId,
    [currentUserId],
  )

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

      setDialogue({
        speakerName,
        text,
        displayedText: '',
        isEmote: opts?.isEmote,
        speakerImageUrl: speaker?.characterImageUrl ?? null,
      })

      let i = 0
      typewriterRef.current = setInterval(() => {
        i++
        setDialogue((current) =>
          current && current.text === text
            ? { ...current, displayedText: text.slice(0, i) }
            : current,
        )
        if (i >= text.length) {
          if (typewriterRef.current) clearInterval(typewriterRef.current)
          typewriterRef.current = null
        }
      }, TYPEWRITER_INTERVAL_MS)
    },
    [participantBySpeakerName, participantByAgentId],
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
      router.refresh()
    },
    onJoined: () => {
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
        isMine: isMine(p.agentUserId),
      })),
    [participants, isMine],
  )

  const positions = useMemo(() => layoutPositions(onStageChars), [onStageChars])

  const mainCharacters: RailCharacter[] = useMemo(
    () =>
      participants
        .filter((p) => p.role === 'main')
        .map((p) => ({
          participantId: p.participantId,
          agentId: p.agentId,
          role: p.role,
          characterName: p.characterName,
          characterImageUrl: p.characterImageUrl,
          isMine: isMine(p.agentUserId),
        })),
    [participants, isMine],
  )

  return (
    <main className="relative h-[calc(100vh-3.5rem)] min-h-[640px] w-full overflow-hidden bg-[#0e0e0e]">
      {/* Stage background — full bleed, no circular ring, no radial vignette */}
      <div className="absolute inset-0">
        {stageImageUrl ? (
          <Image
            src={stageImageUrl}
            alt={`${stageName} backdrop`}
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-70 image-pixelated"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a0a14] via-[#0e0e0e] to-[#080808]" />
        )}
        {/* Soft top + bottom darkening for HUD legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#080808]/80 via-transparent to-[#080808]/85" />
        {/* Left + right edge vignettes for the rail/twist zones */}
        <div className="absolute inset-y-0 left-0 w-72 bg-gradient-to-r from-[#080808]/75 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-80 bg-gradient-to-l from-[#080808]/75 to-transparent" />
      </div>

      {/* Stage area + character sprites */}
      <div className="absolute inset-0 z-10">
        <div className="relative h-full w-full">
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

      <TwistBanner twist={twist} />

      {/* Top-left cluster: Exit Stage → stage name → Characters rail (one cohesive column) */}
      <div className="pointer-events-auto absolute left-5 top-4 z-20 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[#888880] transition-colors hover:text-[#F0EDE8]"
          >
            <span className="text-[#C41E3A]">←</span> Exit Stage
          </Link>
          <h1
            className="text-[28px] font-light italic leading-none tracking-[-0.02em] text-[#F0EDE8]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {stageName}
          </h1>
        </div>
        <CharactersRail
          stageId={stageId}
          mainCharacters={mainCharacters}
          activeAgentId={activeAgentId}
        />
      </div>

      {/* Top-right: Narrative Twist */}
      <div className="absolute right-5 top-4 z-20">
        <NarrativeTwist
          stageId={stageId}
          isLoggedIn={isLoggedIn}
          lastTwistAt={lastTwistAt}
          lastUserTwistAt={lastUserTwistAt}
          liveLastTwistAt={liveLastTwistAt}
          onLocalSubmitSuccess={() => setLiveLastTwistAt(Date.now())}
        />
      </div>

      {/* Bottom-center: Dialogue */}
      <div className="absolute bottom-6 left-1/2 z-20 w-[min(720px,calc(100%-3rem))] -translate-x-1/2">
        <DialoguePanel dialogue={dialogue} />
      </div>
    </main>
  )
}
