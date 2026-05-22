'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { CharactersRail, type RailCharacter } from './characters-rail'
import { NarrativeTwist } from './narrative-twist'
import { DialoguePanel, type CurrentDialogue } from './dialogue-panel'
import { CharacterOnStage, layoutPositions, type OnStageCharacter } from './character-on-stage'
import { ActiveTwistPanel, type ActiveTwist } from './active-twist'
import { StageAboutPanel } from './stage-about-panel'
import { useStageEvents } from './use-stage-events'
import {
  feedItemsFromEvents,
  parseFeedItem,
  type FeedItem,
  type StageEventLike,
} from '@/lib/stage/feed-items'

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
  stageDescription: string | null
  stageImageUrl: string | null
  participants: Participant[]
  initialEvents: StageEvent[]
  isLoggedIn: boolean
  currentUserId: string | null
  lastTwistAt: number | null
  lastUserTwistAt: number | null
  initialLineCount: number
  initialTwistCount: number
}

const TYPEWRITER_INTERVAL_MS = 35
const RECENT_FEED_LIMIT = 5

const THEME_LABELS: Record<string, string> = {
  mythology: 'Mythology',
  strategy: 'Strategy',
  western: 'Western',
  scifi: 'Sci-Fi',
  drama: 'Drama',
  horror: 'Horror',
  crime: 'Crime',
  political: 'Political',
  historical: 'Historical',
  sports: 'Sports',
  heist: 'Heist',
  spy: 'Spy',
  legal: 'Legal',
  dystopia: 'Dystopia',
  'martial-arts': 'Martial Arts',
  shakespeare: 'Shakespeare',
}

export default function StageCanvas({
  stageId,
  stageName,
  stageTheme,
  stageDescription,
  stageImageUrl,
  participants,
  initialEvents,
  isLoggedIn,
  currentUserId,
  lastTwistAt,
  lastUserTwistAt,
  initialLineCount,
  initialTwistCount,
}: StageCanvasProps) {
  const router = useRouter()
  const [dialogue, setDialogue] = useState<CurrentDialogue | null>(null)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [activeTwist, setActiveTwist] = useState<ActiveTwist | null>(null)
  const [feedItems, setFeedItems] = useState<FeedItem[]>(() => {
    const all = feedItemsFromEvents(initialEvents as StageEventLike[])
    const activeDialogueEvent = initialEvents.find((e) => e.type === 'dialogue')
    if (!activeDialogueEvent) return all
    return all.filter((i) => i.id !== activeDialogueEvent.id)
  })
  const [feedBumpKey, setFeedBumpKey] = useState(0)
  const [liveLastTwistAt, setLiveLastTwistAt] = useState<number | null>(lastTwistAt)
  const [lineCount, setLineCount] = useState(initialLineCount)
  const [twistCount, setTwistCount] = useState(initialTwistCount)
  const [aboutOpen, setAboutOpen] = useState(false)
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const dialogueRef = useRef<CurrentDialogue | null>(null)
  dialogueRef.current = dialogue
  const seenEventIdsRef = useRef<Set<string>>(new Set(initialEvents.map((e) => e.id)))

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

  const bumpFeed = useCallback(() => {
    setFeedBumpKey((k) => k + 1)
  }, [])

  const prependFeed = useCallback(
    (item: FeedItem) => {
      setFeedItems((prev) => {
        if (prev.some((p) => p.id === item.id)) return prev
        return [item, ...prev]
      })
      bumpFeed()
    },
    [bumpFeed],
  )

  const archiveCurrentDialogue = useCallback(() => {
    const current = dialogueRef.current
    if (!current?.eventId || !current.displayedText) return
    const text =
      current.displayedText.length >= current.text.length
        ? current.text
        : current.displayedText
    if (!text.trim()) return
    prependFeed({
      kind: 'dialogue',
      id: current.eventId,
      speakerName: current.speakerName,
      text,
      isEmote: current.isEmote,
      createdAt: current.createdAt,
    })
  }, [prependFeed])

  const showDialogue = useCallback(
    (
      speakerName: string,
      text: string,
      opts?: {
        agentId?: string | null
        isEmote?: boolean
        eventId?: string
        createdAt?: number
      },
    ) => {
      if (typewriterRef.current) {
        clearInterval(typewriterRef.current)
        typewriterRef.current = null
      }

      const current = dialogueRef.current
      if (current && current.eventId !== opts?.eventId) {
        archiveCurrentDialogue()
      }

      const matchedByName = participantBySpeakerName.get(speakerName)
      const matchedByAgent = opts?.agentId ? participantByAgentId.get(opts.agentId) : null
      const speaker = matchedByAgent ?? matchedByName ?? null

      setActiveAgentId(speaker?.agentId ?? opts?.agentId ?? null)

      setDialogue({
        eventId: opts?.eventId ?? `local-${Date.now()}`,
        createdAt: opts?.createdAt ?? Date.now(),
        speakerName,
        text,
        displayedText: '',
        isEmote: opts?.isEmote,
        speakerImageUrl: speaker?.characterImageUrl ?? null,
      })

      let i = 0
      typewriterRef.current = setInterval(() => {
        i++
        setDialogue((d) =>
          d && d.text === text ? { ...d, displayedText: text.slice(0, i) } : d,
        )
        if (i >= text.length) {
          if (typewriterRef.current) clearInterval(typewriterRef.current)
          typewriterRef.current = null
        }
      }, TYPEWRITER_INTERVAL_MS)
    },
    [participantBySpeakerName, participantByAgentId, archiveCurrentDialogue],
  )

  const applyTwist = useCallback(
    (item: FeedItem & { kind: 'twist' }) => {
      setActiveTwist({
        text: item.text,
        userDisplayName: item.userDisplayName,
      })
      prependFeed(item)
    },
    [prependFeed],
  )

  useEffect(() => {
    const items = feedItemsFromEvents(initialEvents as StageEventLike[])
    const latestTwist = items.find((i) => i.kind === 'twist')
    if (latestTwist && latestTwist.kind === 'twist') {
      setActiveTwist({
        text: latestTwist.text,
        userDisplayName: latestTwist.userDisplayName,
      })
    }

    const lastDialogue = initialEvents.find((e) => e.type === 'dialogue')
    if (!lastDialogue || typeof lastDialogue.content !== 'object' || lastDialogue.content === null) {
      return
    }
    const c = lastDialogue.content as Record<string, unknown>
    if (typeof c.text === 'string' && typeof c.speakerName === 'string') {
      const createdAt = lastDialogue.createdAt
        ? new Date(lastDialogue.createdAt).getTime()
        : Date.now()
      showDialogue(c.speakerName, c.text, {
        agentId: lastDialogue.agentId,
        isEmote: c.isEmote === true,
        eventId: lastDialogue.id,
        createdAt,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useStageEvents(stageId, {
    onDialogue: (data, raw) => {
      if (!data?.text || !data?.speakerName) return
      if (!seenEventIdsRef.current.has(raw.id)) {
        seenEventIdsRef.current.add(raw.id)
        setLineCount((n) => n + 1)
      }
      showDialogue(data.speakerName, data.text, {
        agentId: raw.agentId,
        isEmote: data.isEmote,
        eventId: raw.id,
        createdAt: raw.createdAt ? new Date(raw.createdAt).getTime() : Date.now(),
      })
    },
    onTwist: (data, raw) => {
      const createdAt = raw.createdAt ? new Date(raw.createdAt).getTime() : Date.now()
      setLiveLastTwistAt(createdAt)
      if (data?.text) {
        if (!seenEventIdsRef.current.has(raw.id)) {
          seenEventIdsRef.current.add(raw.id)
          setTwistCount((n) => n + 1)
        }
        const item = parseFeedItem({
          id: raw.id,
          type: 'twist',
          content: data,
          createdAt: raw.createdAt,
        })
        if (item?.kind === 'twist') applyTwist(item)
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

  const recentItems = useMemo(() => {
    const activeId = dialogue?.eventId
    return feedItems.filter((i) => i.id !== activeId).slice(0, RECENT_FEED_LIMIT)
  }, [feedItems, dialogue?.eventId])

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

  const themeLabel = THEME_LABELS[stageTheme] ?? stageTheme

  return (
    <main className="relative w-full overflow-hidden">
      {/* Stage band: backdrop + sprites + HUD overlays. Aspect matches source image so no vertical crop. */}
      <div className="relative aspect-[16/9] min-h-[640px] w-full">
        {/* Backdrop */}
        <div className="absolute inset-0">
          {stageImageUrl ? (
            <Image
              src={stageImageUrl}
              alt={`${stageName} backdrop`}
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-80 image-pixelated"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a0a14] via-[#0e0e0e] to-[#080808]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-[#080808]/70 via-[#080808]/15 to-[#080808]/80" />
          <div className="absolute inset-y-0 left-0 w-48 bg-gradient-to-r from-[#080808]/60 to-transparent" />
          <div className="absolute inset-y-0 right-0 w-56 bg-gradient-to-l from-[#080808]/60 to-transparent" />
        </div>

        {/* Character sprites */}
        <div className="pointer-events-none absolute inset-0 z-10">
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

        {/* Title bar overlay: exit / centered title + stats / about */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-5 pt-4">
          <div className="pointer-events-auto flex items-start gap-4">
            <Link
              href="/"
              className="mt-1 inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[#F0EDE8]/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] transition-colors hover:text-[#F0EDE8]"
            >
              <span className="text-[#C41E3A]">←</span> Exit Stage
            </Link>
            <div className="flex flex-1 flex-col items-center gap-1.5">
              <h1
                className="text-center text-[28px] font-light italic leading-none tracking-[-0.02em] text-[#F0EDE8] drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {stageName}
              </h1>
              <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#F0EDE8]/80 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
                <span>{themeLabel}</span>
                <span className="text-[#C41E3A]">·</span>
                <span>
                  Lines <span className="text-[#F0EDE8]">{lineCount}</span>
                </span>
                <span className="text-[#C41E3A]">·</span>
                <span>
                  Twists <span className="text-[#F0EDE8]">{twistCount}</span>
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAboutOpen((v) => !v)}
              aria-expanded={aboutOpen}
              className="mt-1 inline-flex shrink-0 items-center gap-1 rounded border border-[#3A3A3A]/60 bg-[#080808]/40 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#F0EDE8]/90 backdrop-blur-sm transition-colors hover:border-[#C41E3A]/60 hover:text-[#F0EDE8]"
            >
              About
            </button>
          </div>
        </div>

        <StageAboutPanel
          description={stageDescription}
          open={aboutOpen}
          onClose={() => setAboutOpen(false)}
        />

        {/* Left HUD stack */}
        <div className="pointer-events-none absolute left-5 top-[5.75rem] z-20 flex w-[min(20rem,calc(100%-2.5rem))] flex-col gap-3 pb-2">
          <CharactersRail
            stageId={stageId}
            mainCharacters={mainCharacters}
            activeAgentId={activeAgentId}
          />
          <NarrativeTwist
            stageId={stageId}
            isLoggedIn={isLoggedIn}
            lastTwistAt={lastTwistAt}
            lastUserTwistAt={lastUserTwistAt}
            liveLastTwistAt={liveLastTwistAt}
            onLocalSubmitSuccess={() => setLiveLastTwistAt(Date.now())}
          />
          <ActiveTwistPanel twist={activeTwist} />
        </div>

        {/* Right HUD — dialogue */}
        <div className="pointer-events-none absolute right-5 top-[5.75rem] z-20 w-[min(20rem,calc(100%-2.5rem))] pb-4">
          <DialoguePanel
            stageId={stageId}
            stageName={stageName}
            dialogue={dialogue}
            recentItems={recentItems}
            allHistoryItems={feedItems}
            feedBumpKey={feedBumpKey}
          />
        </div>
      </div>
    </main>
  )
}
