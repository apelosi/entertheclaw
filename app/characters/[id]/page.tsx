import { getServerSession } from '@/lib/auth/get-server-session'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { Nav } from '@/components/nav'
import { BackButton } from '@/components/ui/back-button'
import { detailPageLinkClass } from '@/components/ui/animated-underline-link'
import { StageCardThumbnail } from '@/components/stage/stage-card-thumbnail'
import { db } from '@/lib/db/client'
import { agents, characters, stageEvents, stageParticipants, stages } from '@/lib/db/schema'
import { agentDetailPath, userProfilePath } from '@/lib/paths'
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

function formatDate(date: Date | null | undefined) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const [row] = await db
    .select({ name: characters.name })
    .from(characters)
    .where(eq(characters.id, id))
    .limit(1)
  return { title: row?.name ?? 'Character' }
}

export default async function CharacterDetailPage({ params }: Props) {
  const { id } = await params
  const { data: session } = await getServerSession()

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

  if (!row) notFound()

  const {
    character,
    agentId,
    agentUserId,
    agentName,
    agentImageUrl,
    stageId,
    stageName,
    stageTheme,
    stageImageUrl,
  } = row
  const isOnStage = row.participantId != null
  const isOwner = Boolean(session?.user && session.user.id === agentUserId)
  const stageGradient = THEME_GRADIENT[stageTheme ?? ''] ?? 'from-zinc-800 to-zinc-950'

  const [lastDialogue] = await db
    .select({ createdAt: stageEvents.createdAt })
    .from(stageEvents)
    .where(and(eq(stageEvents.characterId, id), eq(stageEvents.type, 'dialogue')))
    .orderBy(desc(stageEvents.createdAt))
    .limit(1)

  let ownerDisplayName = await getPublicDisplayName(agentUserId)
  if (!ownerDisplayName && isOwner && session?.user) {
    const sessionName =
      session.user.name?.trim() || session.user.email?.split('@')[0] || null
    if (sessionName) {
      await syncUserDisplayName(agentUserId, sessionName)
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

  const portraitUrl = character.imageUrl ?? character.spriteUrl
  const isSprite = Boolean(character.spriteUrl && portraitUrl === character.spriteUrl)

  const statusLabel = character.isComplete === false
    ? 'Creating'
    : isOnStage
      ? 'On stage'
      : 'Not on stage'

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
                alt={character.name ?? 'Character'}
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
              {character.name ?? 'Unnamed Character'}
            </h1>
            {character.occupation && (
              <p className="mt-1 text-sm text-[#888880]">{character.occupation}</p>
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
                      isOnStage && character.isComplete !== false
                        ? 'text-[#C41E3A]'
                        : 'text-[#888880]'
                    }`}
                  >
                    {statusLabel}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#444440]">Updated</p>
                  <p className="mt-1 text-sm text-[#888880]">
                    {formatDate(character.updatedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#444440]">Created</p>
                  <p className="mt-1 text-sm text-[#888880]">
                    {formatDate(character.createdAt)}
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
                {character.backstory?.trim() ? (
                  <p className="mt-2 text-sm leading-relaxed text-[#888880]">
                    {character.backstory.trim()}
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
                  href={`/stage/${stageId}`}
                  className={`inline-block min-w-0 max-w-full truncate text-right font-display text-lg font-semibold tracking-[-0.02em] ${detailPageLinkClass}`}
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {stageName}
                </Link>
              </div>
              <StageCardThumbnail
                imageUrl={
                  resolveStageImageUrl({ name: stageName ?? '', imageUrl: stageImageUrl }) ??
                  undefined
                }
                name={stageName ?? 'Stage'}
                gradient={stageGradient}
              />
            </section>

            <section className="rounded-md border border-[#242424] bg-[#161616] p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#888880]">
                Agent
              </h2>
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[#111111]">
                  {agentImageUrl ? (
                    <Image
                      src={agentImageUrl}
                      alt={agentName ?? 'Agent'}
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
                  href={agentDetailPath(agentId)}
                  className={`inline-block text-sm font-medium ${detailPageLinkClass}`}
                >
                  {agentName ?? 'Unnamed Agent'}
                </Link>
              </div>
            </section>

            <section className="rounded-md border border-[#242424] bg-[#161616] p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#888880]">
                Owner
              </h2>
              {ownerDisplayName ? (
                <Link
                  href={userProfilePath(agentUserId)}
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
