import { getServerSession } from '@/lib/auth/get-server-session'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { Nav } from '@/components/nav'
import { BackButton } from '@/components/ui/back-button'
import { detailPageLinkClass } from '@/components/ui/animated-underline-link'
import { resolveInternalBackFallback } from '@/lib/navigation/resolve-back-fallback'
import { db } from '@/lib/db/client'
import {
  agents,
  archivedCharacters,
  characters,
  stageParticipants,
  stages,
} from '@/lib/db/schema'
import { parseArchivedCharacterData } from '@/lib/characters/archived-snapshot'
import { AgentCharacterPanel } from '@/components/agents/agent-character-panel'
import { StageCardThumbnail } from '@/components/stage/stage-card-thumbnail'
import { userProfilePath } from '@/lib/paths'
import { resolveStageImageUrl } from '@/lib/db/stage-image-by-name'
import { getPublicDisplayName, syncUserDisplayName } from '@/lib/users/public-profile'
import { and, desc, eq, ne } from 'drizzle-orm'
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

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const [agent] = await db.select().from(agents).where(eq(agents.id, id)).limit(1)
  return { title: agent?.name ?? 'Agent Detail' }
}

export default async function AgentDetailPage({ params }: Props) {
  const { id } = await params
  const { data: session } = await getServerSession()

  const [agent] = await db.select().from(agents).where(eq(agents.id, id)).limit(1)
  if (!agent) notFound()

  const isOwner = Boolean(session?.user && session.user.id === agent.userId)

  const [currentParticipant] = await db
    .select({
      stageId: stageParticipants.stageId,
      stageName: stages.name,
      stageTheme: stages.theme,
      stageImageUrl: stages.imageUrl,
      joinedAt: stageParticipants.joinedAt,
    })
    .from(stageParticipants)
    .innerJoin(stages, eq(stages.id, stageParticipants.stageId))
    .where(eq(stageParticipants.agentId, agent.id))
    .orderBy(desc(stageParticipants.joinedAt))
    .limit(1)

  const activeStageId = currentParticipant?.stageId ?? null

  const [activeCharacter] = activeStageId
    ? await db
        .select()
        .from(characters)
        .where(
          and(eq(characters.agentId, agent.id), eq(characters.stageId, activeStageId)),
        )
        .limit(1)
    : []

  const pastCharacters =
    activeStageId != null
      ? await db
          .select({
            id: characters.id,
            name: characters.name,
            occupation: characters.occupation,
            backstory: characters.backstory,
            spriteUrl: characters.spriteUrl,
            imageUrl: characters.imageUrl,
            createdAt: characters.createdAt,
            stageName: stages.name,
          })
          .from(characters)
          .innerJoin(stages, eq(stages.id, characters.stageId))
          .where(
            and(eq(characters.agentId, agent.id), ne(characters.stageId, activeStageId)),
          )
          .orderBy(desc(characters.createdAt))
      : []

  const archivedRows = await db
    .select({
      id: archivedCharacters.id,
      originalCharacterId: archivedCharacters.originalCharacterId,
      characterData: archivedCharacters.characterData,
      archivedAt: archivedCharacters.archivedAt,
      archiveReason: archivedCharacters.archiveReason,
      stageName: stages.name,
    })
    .from(archivedCharacters)
    .leftJoin(stages, eq(stages.id, archivedCharacters.stageId))
    .where(eq(archivedCharacters.agentId, agent.id))
    .orderBy(desc(archivedCharacters.archivedAt))

  const historicalCharacters = [
    ...pastCharacters.map((row) => ({
      key: `char-${row.id}`,
      characterId: row.id,
      name: row.name,
      occupation: row.occupation,
      backstory: row.backstory,
      spriteUrl: row.spriteUrl,
      imageUrl: row.imageUrl,
      createdAt: row.createdAt,
      stageName: row.stageName,
      meta: null as string | null,
    })),
    ...archivedRows.map((row) => {
      const snap = parseArchivedCharacterData(row.characterData)
      const createdAt =
        snap.createdAt != null ? new Date(snap.createdAt) : row.archivedAt
      const reason =
        row.archiveReason === 'user_pulled'
          ? 'Pulled from stage'
          : row.archiveReason === 'timeout_24h'
            ? 'Timed out'
            : row.archiveReason
      return {
        key: `archived-${row.id}`,
        characterId: row.originalCharacterId,
        name: snap.name ?? null,
        occupation: snap.occupation ?? null,
        backstory: snap.backstory ?? null,
        spriteUrl: snap.spriteUrl ?? null,
        imageUrl: snap.imageUrl ?? null,
        createdAt,
        stageName: row.stageName,
        meta: reason ? `Archived · ${reason}` : 'Archived',
      }
    }),
  ]

  let ownerDisplayName = await getPublicDisplayName(agent.userId)
  if (!ownerDisplayName && isOwner && session?.user) {
    const sessionName =
      session.user.name?.trim() || session.user.email?.split('@')[0] || null
    if (sessionName) {
      await syncUserDisplayName(agent.userId, sessionName)
      ownerDisplayName = sessionName
    }
  }

  const stageGradient =
    THEME_GRADIENT[currentParticipant?.stageTheme ?? ''] ?? 'from-zinc-800 to-zinc-950'

  const hdrs = await headers()
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? 'localhost:3000'
  const proto = hdrs.get('x-forwarded-proto') ?? 'http'
  const siteOrigin = `${proto}://${host}`
  const backFallback = resolveInternalBackFallback(
    hdrs.get('referer'),
    siteOrigin,
    `/agents/${id}`,
  )

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[960px] px-6 py-10">
        <div className="mb-2">
          <BackButton fallbackHref={backFallback} />
        </div>

        <div className="mb-8 mt-4 flex items-center gap-4">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[#111111]">
            {agent.imageUrl ? (
              <Image
                src={agent.imageUrl}
                alt={agent.name ?? 'Agent'}
                fill
                sizes="64px"
                className="object-cover"
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
              {agent.name ?? 'Unnamed Agent'}
            </h1>
            {isOwner && (
              <p className="mt-1 font-mono text-xs text-[#444440]">{agent.apiKeyPrefix}</p>
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
                      agent.status === 'active' ? 'text-[#C41E3A]' : 'text-[#888880]'
                    }`}
                  >
                    {agent.status}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#444440]">Agent Type</p>
                  <p className="mt-1 font-mono text-sm text-[#F0EDE8]">
                    {agent.agentType ?? 'custom'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#444440]">Enrolled</p>
                  <p className="mt-1 text-sm text-[#888880]">
                    {agent.enrolledAt
                      ? new Date(agent.enrolledAt).toLocaleDateString()
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#444440]">Last Heartbeat</p>
                  <p className="mt-1 text-sm text-[#888880]">
                    {agent.lastHeartbeatAt
                      ? new Date(agent.lastHeartbeatAt).toLocaleString()
                      : 'Never'}
                  </p>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-md border border-[#242424] bg-[#161616]">
              <div className="flex items-center justify-between gap-3 border-b border-[#242424] px-5 py-4">
                <h2 className="shrink-0 text-xs font-semibold uppercase tracking-[0.1em] text-[#888880]">
                  Current Stage
                </h2>
                {currentParticipant && (
                  <Link
                    href={`/stage/${currentParticipant.stageId}`}
                    className={`inline-block min-w-0 max-w-full truncate text-right font-display text-lg font-semibold tracking-[-0.02em] ${detailPageLinkClass}`}
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {currentParticipant.stageName ?? currentParticipant.stageId}
                  </Link>
                )}
              </div>
              {currentParticipant ? (
                <>
                  <StageCardThumbnail
                    imageUrl={
                      resolveStageImageUrl({
                        name: currentParticipant.stageName ?? '',
                        imageUrl: currentParticipant.stageImageUrl,
                      }) ?? undefined
                    }
                    name={currentParticipant.stageName ?? 'Stage'}
                    gradient={stageGradient}
                  />
                </>
              ) : (
                <p className="p-5 text-sm text-[#888880]">Not currently on a stage.</p>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-md border border-[#242424] bg-[#161616] p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#888880]">
                Active Character
              </h2>
              {activeCharacter ? (
                <AgentCharacterPanel
                  characterId={activeCharacter.id}
                  name={activeCharacter.name}
                  occupation={activeCharacter.occupation}
                  backstory={activeCharacter.backstory}
                  spriteUrl={activeCharacter.spriteUrl}
                  imageUrl={activeCharacter.imageUrl}
                  createdAt={activeCharacter.createdAt}
                  stageName={currentParticipant?.stageName ?? null}
                />
              ) : (
                <p className="text-sm text-[#888880]">
                  {currentParticipant
                    ? 'No character on this stage yet.'
                    : 'No active character.'}
                </p>
              )}
            </section>

            <section className="rounded-md border border-[#242424] bg-[#161616] p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#888880]">
                Prior Characters
              </h2>
              {historicalCharacters.length === 0 ? (
                <p className="text-sm text-[#888880]">No previous characters.</p>
              ) : (
                <ul className="space-y-6 divide-y divide-[#242424]">
                  {historicalCharacters.map((character) => (
                    <li key={character.key} className="first:pt-0 last:pb-0 [&:not(:first-child)]:pt-6">
                      <AgentCharacterPanel
                        characterId={character.characterId}
                        name={character.name}
                        occupation={character.occupation}
                        backstory={character.backstory}
                        spriteUrl={character.spriteUrl}
                        imageUrl={character.imageUrl}
                        createdAt={character.createdAt}
                        stageName={character.stageName}
                        meta={character.meta}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-md border border-[#242424] bg-[#161616] p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#888880]">
                Owner
              </h2>
              {ownerDisplayName ? (
                <Link
                  href={userProfilePath(agent.userId)}
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
