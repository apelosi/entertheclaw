import { getServerSession } from '@/lib/auth/get-server-session'
import { Nav } from '@/components/nav'
import { BackButton } from '@/components/ui/back-button'
import { AgentCard } from '@/components/agents/agent-card'
import { CharacterCard } from '@/components/characters/character-card'
import { resolveInternalBackFallback } from '@/lib/navigation/resolve-back-fallback'
import { getPublicDisplayName, syncUserDisplayName } from '@/lib/users/public-profile'
import { getUserActiveAgents, getUserActiveCharacters } from '@/lib/users/profile-queries'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const displayName = await getPublicDisplayName(id)
  return { title: displayName ?? 'Profile' }
}

export default async function UserProfilePage({ params }: Props) {
  const { id: userId } = await params
  const { data: session } = await getServerSession()
  const isOwner = Boolean(session?.user && session.user.id === userId)

  let displayName = await getPublicDisplayName(userId)
  if (!displayName && isOwner && session?.user) {
    const sessionName =
      session.user.name?.trim() || session.user.email?.split('@')[0] || null
    if (sessionName) {
      await syncUserDisplayName(userId, sessionName)
      displayName = sessionName
    }
  }

  if (!displayName) notFound()

  const [activeAgents, activeCharacters] = await Promise.all([
    getUserActiveAgents(userId),
    getUserActiveCharacters(userId),
  ])

  const hdrs = await headers()
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? 'localhost:3000'
  const proto = hdrs.get('x-forwarded-proto') ?? 'http'
  const siteOrigin = `${proto}://${host}`
  const backFallback = resolveInternalBackFallback(
    hdrs.get('referer'),
    siteOrigin,
    `/users/${userId}`,
    '/',
  )

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[960px] px-6 py-10">
        <div className="mb-2">
          <BackButton fallbackHref={backFallback} />
        </div>

        <div className="mb-8 mt-4">
          <h1
            className="font-display text-[32px] font-semibold tracking-[-0.02em] text-[#F0EDE8]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {displayName}
          </h1>
          <p className="mt-1 text-sm text-[#888880]">Director profile</p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-md border border-[#242424] bg-[#161616] p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#888880]">
              Agents
            </h2>
            {activeAgents.length === 0 ? (
              <p className="text-sm text-[#888880]">No agents.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
                {activeAgents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    id={agent.id}
                    name={agent.name}
                    imageUrl={agent.imageUrl}
                    agentType={agent.agentType}
                    status={agent.status}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="rounded-md border border-[#242424] bg-[#161616] p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#888880]">
              Characters
            </h2>
            {activeCharacters.length === 0 ? (
              <p className="text-sm text-[#888880]">No characters.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
                {activeCharacters.map((char) => (
                  <CharacterCard
                    key={char.id}
                    id={char.id}
                    name={char.name}
                    imageUrl={char.imageUrl}
                    occupation={char.occupation}
                    stageId={char.stageId}
                    isComplete={char.isComplete}
                    status={char.status}
                    agentName={char.agentName}
                    stageName={char.stageName}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
