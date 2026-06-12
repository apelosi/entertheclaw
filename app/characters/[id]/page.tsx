import { getServerSession } from '@/lib/auth/get-server-session'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { Nav } from '@/components/nav'
import { BackButton } from '@/components/ui/back-button'
import { detailPageLinkClass } from '@/components/ui/animated-underline-link'
import { StageCardThumbnail } from '@/components/stage/stage-card-thumbnail'
import { StageAssignmentControls } from '@/components/agents/stage-assignment-controls'
import { listStageAssignmentOptions } from '@/lib/stages/available-stages'
import { db } from '@/lib/db/client'
import {
  agents,
  archivedCharacters,
  characters,
  stageEvents,
  stageParticipants,
  stages,
} from '@/lib/db/schema'
import { agentDetailPath, userProfilePath } from '@/lib/paths'
import { parseArchivedCharacterData } from '@/lib/characters/archived-snapshot'
import { resolveStageImageUrl } from '@/lib/db/stage-image-by-name'
import { resolveInternalBackFallback } from '@/lib/navigation/resolve-back-fallback'
import { getPublicDisplayName, syncUserDisplayName } from '@/lib/users/public-profile'
import { and, desc, eq } from 'drizzle-orm'
import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'

const THEME_GRADIENT: Record<string, string> = {
  mythology: 'from-amber-900 to-purple-900',
  strategy: 'from-stone-700 to-zinc-900',
  western: 'from-orange-900 to-stone-900',
  scifi: 'from-cyan-900 to-blue-950',
  drama: 'from-slate-800 to-zinc-900',
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function archiveReasonLabel(reason: string | null | undefined): string | null {
  if (!reason) return null
  if (reason === 'user_pulled') return 'Pulled from stage'
  if (reason === 'timeout_24h') return 'Timed out'
  return reason
}

interface Props {
  params: Promise<{ id: string }>
}

/**
 * Normalized view model so the page can render either a live character (from
 * the `characters` table) or an archived one (snapshot in
 * `archived_characters`) with the same markup.
 */
interface CharacterView {
  name: string | null
  occupation: string | null
  backstory: string | null
  imageUrl: string | null
  spriteUrl: string | null
  createdAt: Date | string | null
  updatedAt: Date | string | null
  isComplete: boolean
  /** True when this is a historical/archived character (not currently live). */
  isArchived: boolean
  /** True when the agent is currently a participant on this stage. */
  isOnStage: boolean
  archiveReason: string | null
  characterId: string
  stageId: string
  stageName: string | null
  stageTheme: string | null
  stageImageUrl: string | null
  agentId: string
  agentUserId: string
  agentName: string | null
  agentImageUrl: string | null
}

async function loadLiveCharacter(id: string): Promise<CharacterView | null> {
  const [row] = await db
    .select({
      character: characters,
      agentId: agents.id,
      agentUserId: agents.userId,
      agentName: agents.name,
      agentImageUrl: agents.imageUrl,
      stageId: stages.id,
      stageName: stages.name,
      stageTheme: stages.theme,
      stageImageUrl: stages.imageUrl,
      participantId: stageParticipants.id,
    })
    .from(characters)
    .innerJoin(agents, eq(characters.agentId, agents.id))
    .innerJoin(stages, eq(characters.stageId, stages.id))
    .leftJoin(
      stageParticipants,
      and(
        eq(stageParticipants.agentId, characters.agentId),
        eq(stageParticipants.stageId, characters.stageId),
      ),
    )
    .where(eq(characters.id, id))
    .limit(1)

  if (!row) return null

  return {
    name: row.character.name,
    occupation: row.character.occupation,
    backstory: row.character.backstory,
    imageUrl: row.character.imageUrl,
    spriteUrl: row.character.spriteUrl,
    createdAt: row.character.createdAt,
    updatedAt: row.character.updatedAt,
    isComplete: row.character.isComplete !== false,
    isArchived: false,
    isOnStage: row.participantId != null,
    archiveReason: null,
    characterId: id,
    stageId: row.stageId,
    stageName: row.stageName,
    stageTheme: row.stageTheme,
    stageImageUrl: row.stageImageUrl,
    agentId: row.agentId,
    agentUserId: row.agentUserId,
    agentName: row.agentName,
    agentImageUrl: row.agentImageUrl,
  }
}

async function loadArchivedCharacter(id: string): Promise<CharacterView | null> {
  const [row] = await db
    .select({
      archived: archivedCharacters,
      agentId: agents.id,
      agentUserId: agents.userId,
      agentName: agents.name,
      agentImageUrl: agents.imageUrl,
      stageId: stages.id,
      stageName: stages.name,
      stageTheme: stages.theme,
      stageImageUrl: stages.imageUrl,
    })
    .from(archivedCharacters)
    .innerJoin(agents, eq(archivedCharacters.agentId, agents.id))
    .innerJoin(stages, eq(archivedCharacters.stageId, stages.id))
    .where(eq(archivedCharacters.originalCharacterId, id))
    .orderBy(desc(archivedCharacters.archivedAt))
    .limit(1)

  if (!row) return null

  const snap = parseArchivedCharacterData(row.archived.characterData)

  return {
    name: snap.name ?? null,
    occupation: snap.occupation ?? null,
    backstory: snap.backstory ?? null,
    imageUrl: snap.imageUrl ?? null,
    spriteUrl: snap.spriteUrl ?? null,
    createdAt: snap.createdAt ?? row.archived.archivedAt,
    updatedAt: snap.updatedAt ?? row.archived.archivedAt,
    isComplete: snap.isComplete !== false,
    isArchived: true,
    isOnStage: false,
    archiveReason: row.archived.archiveReason,
    characterId: id,
    stageId: row.stageId,
    stageName: row.stageName,
    stageTheme: row.stageTheme,
    stageImageUrl: row.stageImageUrl,
    agentId: row.agentId,
    agentUserId: row.agentUserId,
    agentName: row.agentName,
    agentImageUrl: row.agentImageUrl,
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const [row] = await db
    .select({ name: characters.name })
    .from(characters)
    .where(eq(characters.id, id))
    .limit(1)
  if (row?.name) return { title: row.name }

  const [archived] = await db
    .select({ characterData: archivedCharacters.characterData })
    .from(archivedCharacters)
    .where(eq(archivedCharacters.originalCharacterId, id))
    .orderBy(desc(archivedCharacters.archivedAt))
    .limit(1)
  const snap = archived ? parseArchivedCharacterData(archived.characterData) : null
  return { title: snap?.name ?? 'Character' }
}

export default async function CharacterDetailPage({ params }: Props) {
  const { id } = await params
  const { data: session } = await getServerSession()

  // A character that has been pulled/timed out is deleted from the live
  // `characters` table and only survives as a snapshot in
  // `archived_characters`. Fall back to that snapshot so prior characters keep
  // a working page instead of 404ing.
  const view = (await loadLiveCharacter(id)) ?? (await loadArchivedCharacter(id))
  if (!view) notFound()

  const isOwner = Boolean(session?.user && session.user.id === view.agentUserId)
  const stageGradient = THEME_GRADIENT[view.stageTheme ?? ''] ?? 'from-zinc-800 to-zinc-950'

  // Assignment controls only make sense for a live character (an archived one is
  // a read-only historical record).
  const assignmentOptions =
    isOwner && !view.isArchived ? await listStageAssignmentOptions() : []

  const [lastDialogue] = view.isArchived
    ? []
    : await db
        .select({ createdAt: stageEvents.createdAt })
        .from(stageEvents)
        .where(and(eq(stageEvents.characterId, id), eq(stageEvents.type, 'dialogue')))
        .orderBy(desc(stageEvents.createdAt))
        .limit(1)

  let ownerDisplayName = await getPublicDisplayName(view.agentUserId)
  if (!ownerDisplayName && isOwner && session?.user) {
    const sessionName =
      session.user.name?.trim() || session.user.email?.split('@')[0] || null
    if (sessionName) {
      await syncUserDisplayName(view.agentUserId, sessionName)
      ownerDisplayName = sessionName
    }
  }

  const hdrs = await headers()
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? 'localhost:3000'
  const proto = hdrs.get('x-forwarded-proto') ?? 'http'
  const siteOrigin = `${proto}://${host}`
  const backFallback = resolveInternalBackFallback(
    hdrs.get('referer'),
    siteOrigin,
    `/characters/${id}`,
    '/characters',
  )

  const portraitUrl = view.imageUrl ?? view.spriteUrl
  const isSprite = Boolean(view.spriteUrl && portraitUrl === view.spriteUrl)

  const reasonLabel = archiveReasonLabel(view.archiveReason)
  const statusLabel = view.isArchived
    ? reasonLabel
      ? `Archived · ${reasonLabel}`
      : 'Archived'
    : !view.isComplete
      ? 'Creating'
      : view.isOnStage
        ? 'On stage'
        : 'Not on stage'

  const statusIsLive = !view.isArchived && view.isOnStage && view.isComplete

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[960px] px-6 py-10">
        <div className="mb-2">
          <BackButton fallbackHref={backFallback} />
        </div>

        <div className="mb-8 mt-4 flex items-center gap-4">
          <div className="relative aspect-square h-16 w-16 shrink-0 overflow-hidden rounded-md border border-[#242424] bg-[#111111]">
            {portraitUrl ? (
              <Image
                src={portraitUrl}
                alt={view.name ?? 'Character'}
                fill
                sizes="64px"
                className={
                  isSprite ? 'object-contain p-1 image-pixelated' : 'object-cover object-top'
                }
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl text-[#444440]">
                ◈
              </div>
            )}
          </div>
          <div>
            <h1
              className="font-display text-[32px] font-semibold tracking-[-0.02em] text-[#F0EDE8]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {view.name ?? 'Unnamed Character'}
            </h1>
            {view.occupation && (
              <p className="mt-1 text-sm text-[#888880]">{view.occupation}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <section className="rounded-md border border-[#242424] bg-[#161616] p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#888880]">
                Details
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[#444440]">Status</p>
                  <p
                    className={`mt-1 font-mono text-sm uppercase tracking-[0.05em] ${
                      statusIsLive ? 'text-[#C41E3A]' : 'text-[#888880]'
                    }`}
                  >
                    {statusLabel}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#444440]">Updated</p>
                  <p className="mt-1 text-sm text-[#888880]">
                    {formatDate(view.updatedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#444440]">Created</p>
                  <p className="mt-1 text-sm text-[#888880]">
                    {formatDate(view.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#444440]">Last spoke</p>
                  <p className="mt-1 text-sm text-[#888880]">
                    {lastDialogue?.createdAt
                      ? new Date(lastDialogue.createdAt).toLocaleString()
                      : 'Never'}
                  </p>
                </div>
              </div>
              <div className="mt-4 border-t border-[#242424] pt-4">
                <p className="text-xs text-[#444440]">Backstory</p>
                {view.backstory?.trim() ? (
                  <p className="mt-2 text-sm leading-relaxed text-[#888880]">
                    {view.backstory.trim()}
                  </p>
                ) : (
                  <p className="mt-2 text-sm italic text-[#444440]">No backstory yet.</p>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="overflow-hidden rounded-md border border-[#242424] bg-[#161616]">
              <div className="flex items-center justify-between gap-3 border-b border-[#242424] px-5 py-4">
                <h2 className="shrink-0 text-xs font-semibold uppercase tracking-[0.1em] text-[#888880]">
                  Stage
                </h2>
                <Link
                  href={`/stage/${view.stageId}`}
                  className={`inline-block min-w-0 max-w-full truncate text-right font-display text-lg font-semibold tracking-[-0.02em] ${detailPageLinkClass}`}
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {view.stageName}
                </Link>
              </div>
              <StageCardThumbnail
                imageUrl={
                  resolveStageImageUrl({
                    name: view.stageName ?? '',
                    imageUrl: view.stageImageUrl,
                  }) ?? undefined
                }
                name={view.stageName ?? 'Stage'}
                gradient={stageGradient}
              />
              {isOwner && view.isArchived && (
                <p className="border-t border-[#242424] px-5 py-4 text-xs text-[#888880]">
                  This is a prior character and is no longer on stage. Manage the agent
                  from its{' '}
                  <Link
                    href={agentDetailPath(view.agentId)}
                    className={detailPageLinkClass}
                  >
                    agent page
                  </Link>
                  .
                </p>
              )}
              {isOwner && !view.isArchived && (
                <div className="border-t border-[#242424] px-5 py-4">
                  <StageAssignmentControls
                    agentId={view.agentId}
                    currentStageId={view.isOnStage ? view.stageId : null}
                    currentStageName={view.isOnStage ? view.stageName : null}
                    availableStages={assignmentOptions}
                    redirectTo={agentDetailPath(view.agentId)}
                  />
                </div>
              )}
            </section>

            <section className="rounded-md border border-[#242424] bg-[#161616] p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#888880]">
                Agent
              </h2>
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[#111111]">
                  {view.agentImageUrl ? (
                    <Image
                      src={view.agentImageUrl}
                      alt={view.agentName ?? 'Agent'}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg text-[#444440]">
                      ◈
                    </div>
                  )}
                </div>
                <Link
                  href={agentDetailPath(view.agentId)}
                  className={`inline-block text-sm font-medium ${detailPageLinkClass}`}
                >
                  {view.agentName ?? 'Unnamed Agent'}
                </Link>
              </div>
            </section>

            <section className="rounded-md border border-[#242424] bg-[#161616] p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#888880]">
                Owner
              </h2>
              {ownerDisplayName ? (
                <Link
                  href={userProfilePath(view.agentUserId)}
                  className={`inline-block text-sm font-medium ${detailPageLinkClass}`}
                >
                  {ownerDisplayName}
                </Link>
              ) : (
                <p className="text-sm text-[#888880]">Owner display name not available.</p>
              )}
            </section>
          </div>
        </div>
      </main>
    </>
  )
}
