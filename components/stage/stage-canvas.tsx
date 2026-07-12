'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { CastCard, type RailCharacter } from './cast-card'
import { TwistComposer } from './twist-composer'
import { SceneCard, type CurrentScene } from './scene-card'
import { DialoguePanel } from './dialogue-panel'
import { StageActionBar } from './stage-action-bar'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { CharacterOnStage, layoutPositions, type OnStageCharacter } from './character-on-stage'
import { type ActiveTwist } from './active-twist'
import { StageAboutPanel } from './stage-about-panel'
import { SceneChangeOverlay } from './scene-change-overlay'
import type { CurrentLine } from './stage-feed'
import { useStageEvents } from './use-stage-events'
import { useStageFeed } from './use-stage-feed'
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
  characterId: string | null
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
  stageCreatedAt: string | null
  participants: Participant[]
  initialEvents: StageEvent[]
  initialScene: CurrentScene | null
  isLoggedIn: boolean
  currentUserId: string | null
  twistsEnabled: boolean
  lastTwistAt: number | null
  lastUserTwistAt: number | null
  initialActiveTwist: ActiveTwist | null
}

const TYPEWRITER_INTERVAL_MS = 35

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
  stageCreatedAt,
  participants,
  initialEvents,
  initialScene,
  isLoggedIn,
  currentUserId,
  twistsEnabled,
  lastTwistAt,
  lastUserTwistAt,
  initialActiveTwist,
}: StageCanvasProps) {
  const router = useRouter()
  const [dialogue, setDialogue] = useState<CurrentLine | null>(null)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [activeTwist, setActiveTwist] = useState<ActiveTwist | null>(initialActiveTwist)
  const [liveLastTwistAt, setLiveLastTwistAt] = useState<number | null>(lastTwistAt)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [activeSheet, setActiveSheet] = useState<'scene' | 'twist' | 'cast' | null>(null)
  const [currentScene, setCurrentScene] = useState<CurrentScene | null>(initialScene)
  const [pendingSceneOverlay, setPendingSceneOverlay] = useState<CurrentScene | null>(null)
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const dialogueRef = useRef<CurrentLine | null>(null)
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

  const isDialogueMine = useCallback(
    (agentId: string | null | undefined) => {
      if (!agentId) return false
      return isMine(participantByAgentId.get(agentId)?.agentUserId ?? null)
    },
    [isMine, participantByAgentId],
  )

  // Recent events from the server, minus the one currently animating (it lives
  // in `dialogue`, not the completed feed). Ownership on dialogue lines is
  // resolved from current participants. Seeded once; live updates flow through
  // the feed hook.
  const initialFeedItems = useMemo(() => {
    const activeDialogueEvent = initialEvents.find((e) => e.type === 'dialogue')
    return feedItemsFromEvents(initialEvents as StageEventLike[])
      .filter((i) => i.id !== activeDialogueEvent?.id)
      .map((i) => (i.kind === 'dialogue' && isDialogueMine(i.agentId) ? { ...i, isOwn: true } : i))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const feed = useStageFeed({ stageId, initialItems: initialFeedItems })
  const { pushLive } = feed

  const archiveCurrentDialogue = useCallback(() => {
    const current = dialogueRef.current
    if (!current?.eventId || !current.displayedText) return
    const text =
      current.displayedText.length >= current.text.length
        ? current.text
        : current.displayedText
    if (!text.trim()) return
    pushLive({
      kind: 'dialogue',
      id: current.eventId,
      speakerName: current.speakerName,
      text,
      isEmote: current.isEmote,
      createdAt: current.createdAt,
      speakerImageUrl: current.speakerImageUrl ?? null,
      ...(current.isOwn ? { isOwn: true } : {}),
    })
  }, [pushLive])

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
        isOwn: isMine(speaker?.agentUserId ?? null),
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
    [participantBySpeakerName, participantByAgentId, archiveCurrentDialogue, isMine],
  )

  const applyTwist = useCallback(
    (item: FeedItem & { kind: 'twist' }) => {
      setActiveTwist({
        text: item.text,
        userDisplayName: item.userDisplayName,
      })
      pushLive(item)
    },
    [pushLive],
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
    onSceneChange: (data, raw) => {
      if (!data?.name || !data?.description) return
      const next: CurrentScene = { name: data.name, description: data.description }
      setCurrentScene(next)
      setPendingSceneOverlay(next)
      if (!seenEventIdsRef.current.has(raw.id)) {
        seenEventIdsRef.current.add(raw.id)
        const createdAt = raw.createdAt ? new Date(raw.createdAt).getTime() : Date.now()
        pushLive({
          kind: 'scene',
          id: raw.id,
          name: data.name,
          description: data.description,
          reason: data.reason,
          createdAt,
        })
      }
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
        characterId: p.characterId,
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
          characterId: p.characterId,
          role: p.role,
          characterName: p.characterName,
          characterImageUrl: p.characterImageUrl,
          isMine: isMine(p.agentUserId),
        })),
    [participants, isMine],
  )

  const speakerImageByName = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const p of participants) {
      if (p.characterName) map.set(p.characterName, p.characterImageUrl)
    }
    return map
  }, [participants])

  const themeLabel = THEME_LABELS[stageTheme] ?? stageTheme

  const dialogueProps = {
    stageId,
    feed,
    currentLine: dialogue,
    speakerImageByName,
  }

  const twistProps = {
    stageId,
    isLoggedIn,
    twistsEnabled,
    lastTwistAt,
    lastUserTwistAt,
    liveLastTwistAt,
    onLocalSubmitSuccess: (twist: {
      eventId: string
      text: string
      userDisplayName: string
      createdAt: number
    }) => {
      setLiveLastTwistAt(twist.createdAt)
      // Mark the event as seen so the WS broadcast doesn't double-apply it.
      seenEventIdsRef.current.add(twist.eventId)
      applyTwist({
        kind: 'twist',
        id: twist.eventId,
        text: twist.text,
        userDisplayName: twist.userDisplayName,
        isOwn: true,
        createdAt: twist.createdAt,
      })
    },
    activeTwist,
  }

  const castProps = {
    stageId,
    mainCharacters,
    activeAgentId,
  }

  return (
    <main className="relative mx-auto w-full max-w-[1280px] bg-[#080808]">
      {/* Stage band: backdrop + sprites. Capped to the same max-width as the panels below
          so the room never balloons across the full viewport on large displays. */}
      <div className="relative aspect-[16/9] min-h-[200px] w-full overflow-hidden max-md:min-h-[160px]">
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

        {/* Slim title bar: ← LIVE | Stage Name | About — z-30 so it renders above dialogue overlay */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-4 pt-3 max-md:px-3 max-md:pt-2">
          <div className="pointer-events-auto grid grid-cols-[1fr_auto_1fr] items-center gap-3 max-md:gap-2">
            <div className="flex min-w-0 items-center gap-3 max-md:gap-2">
              {/* Back — icon only on mobile, label on desktop */}
              <Link
                href="/"
                aria-label="Exit stage"
                className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[#F0EDE8]/70 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] transition-colors hover:text-[#F0EDE8] max-md:gap-1 max-md:text-[9px] max-md:tracking-[0.14em]"
              >
                <span>←</span>
                <span className="hidden sm:inline">Exit Stage</span>
              </Link>

              <LiveBadge isLive={Boolean(dialogue)} />
            </div>

            {/* Stage name — centered between equal-width side columns */}
            <h1
              className="min-w-0 truncate text-center text-[22px] font-light italic leading-none tracking-[-0.02em] text-[#F0EDE8] drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)] max-md:text-[17px] sm:text-[28px]"
              style={{ fontFamily: 'var(--font-display)' }}
              title={stageName}
            >
              {stageName}
            </h1>

            {/* About */}
            <div className="flex min-w-0 justify-end">
              <button
                type="button"
                onClick={() => setAboutOpen((v) => !v)}
                aria-expanded={aboutOpen}
                className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-[#F0EDE8]/70 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] transition-colors hover:text-[#F0EDE8] max-md:text-[8px] max-md:tracking-[0.14em]"
              >
                About
              </button>
            </div>
          </div>
        </div>

        {/* Scene change announcement — 5s overlay over the stage band */}
        <SceneChangeOverlay
          scene={pendingSceneOverlay}
          onDone={() => setPendingSceneOverlay(null)}
        />
      </div>

      {/* Outside overflow-hidden stage band so long copy can extend over panels below */}
      <StageAboutPanel
        description={stageDescription}
        theme={stageTheme}
        themeLabel={themeLabel}
        createdAt={stageCreatedAt}
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
      />

      {/* Mobile-only sticky action bar: current scene + cast + the twist/invite
          CTAs, each opening a bottom sheet. Hidden on lg where the rail shows
          these as always-expanded cards. */}
      <StageActionBar
        sceneName={currentScene?.name ?? null}
        castCount={mainCharacters.length}
        twistsEnabled={twistsEnabled}
        onOpenScene={() => setActiveSheet('scene')}
        onOpenCast={() => setActiveSheet('cast')}
        onOpenTwist={() => setActiveSheet('twist')}
      />

      {/* Panels — feed (wide) on the left, current-state rail (narrow) on the right.
          The rail is hidden on mobile, where its cards open as bottom sheets. */}
      <div className="grid gap-3 p-4 max-md:gap-2 max-md:p-3 lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-5 lg:p-6">
        <DialoguePanel {...dialogueProps} />
        <div className="flex flex-col gap-3 max-lg:hidden">
          <SceneCard scene={currentScene} />
          <TwistComposer {...twistProps} />
          <CastCard {...castProps} />
        </div>
      </div>

      {/* Mobile bottom sheets — render the same rail cards in `bare` mode. */}
      <BottomSheet
        open={activeSheet === 'scene'}
        onClose={() => setActiveSheet(null)}
        title="Scene"
      >
        <SceneCard scene={currentScene} bare />
      </BottomSheet>
      <BottomSheet
        open={activeSheet === 'twist'}
        onClose={() => setActiveSheet(null)}
        title="Twists"
      >
        <TwistComposer {...twistProps} bare />
      </BottomSheet>
      <BottomSheet
        open={activeSheet === 'cast'}
        onClose={() => setActiveSheet(null)}
        title="Cast"
      >
        <CastCard {...castProps} bare />
      </BottomSheet>
    </main>
  )
}

function LiveBadge({ isLive }: { isLive: boolean }) {
  return (
    <span
      aria-label={isLive ? 'Stage is live' : 'Stage is idle'}
      className={
        'inline-flex shrink-0 items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] max-md:gap-1 max-md:px-1.5 max-md:py-0.5 max-md:text-[8px] max-md:tracking-[0.14em] ' +
        (isLive
          ? 'border-[#C41E3A]/50 bg-[#C41E3A]/15 text-[#C41E3A]'
          : 'border-[#444440]/40 bg-[#080808]/40 text-[#888880]')
      }
    >
      <span className="relative flex h-1.5 w-1.5 max-md:h-1 max-md:w-1">
        {isLive && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C41E3A] opacity-60" />
        )}
        <span
          className={
            'relative inline-flex h-1.5 w-1.5 rounded-full ' +
            (isLive ? 'bg-[#C41E3A] shadow-[0_0_6px_#C41E3A]' : 'bg-[#888880]')
          }
        />
      </span>
      {isLive ? 'Live' : 'Idle'}
    </span>
  )
}
