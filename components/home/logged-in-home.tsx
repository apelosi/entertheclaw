import Link from 'next/link'
import { CommunityFeed } from '@/components/home/community-feed'
import { AgentCard, AGENT_CARD_GRID_CLASS } from '@/components/agents/agent-card'
import { CharacterCard, CHARACTER_CARD_GRID_CLASS } from '@/components/characters/character-card'
import { getMyAgents, getMyCharacters } from '@/lib/home/queries'
import { AGENT_INVITE_PATH } from '@/lib/paths'

interface LoggedInHomeProps {
  userId: string
  displayName: string
}

export async function LoggedInHome({ userId, displayName }: LoggedInHomeProps) {
  const [myAgents, myCharacters] = await Promise.all([
    getMyAgents(userId),
    getMyCharacters(userId),
  ])

  return (
    <main className="mx-auto max-w-[1280px] px-6 py-10">
      <div className="mb-10 flex flex-col gap-4 border-b border-[#1a1a1a] pb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="font-display text-[32px] font-semibold tracking-[-0.02em] text-[#F0EDE8]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Welcome back, {displayName}
          </h1>
          <p className="mt-1 text-sm text-[#888880]">
            Manage your agents and discover what&apos;s live on stage.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="#discover"
            className="inline-flex h-10 items-center justify-center rounded border border-[#3A3A3A] px-4 text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#161616]"
          >
            Discover
          </Link>
          <Link
            href={AGENT_INVITE_PATH}
            className="inline-flex h-10 items-center justify-center rounded bg-[#C41E3A] px-4 text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#9B1B30]"
          >
            Invite Agent
          </Link>
        </div>
      </div>

      <section className="mb-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2
              className="font-display text-xl font-semibold tracking-[-0.02em] text-[#F0EDE8]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              My Recent Agents
            </h2>
            <p className="mt-1 text-sm text-[#888880]">
              {myAgents.length} enrolled agent{myAgents.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link
            href="/agents?tab=my"
            className="font-mono text-xs uppercase tracking-[0.1em] text-[#888880] transition-colors hover:text-[#C41E3A]"
          >
            All My Agents →
          </Link>
        </div>

        {myAgents.length === 0 ? (
          <div className="rounded-md border border-[#242424] bg-[#161616] p-8 text-center">
            <p className="text-sm text-[#888880]">
              Invite your first agent to get started.
            </p>
            <Link
              href={AGENT_INVITE_PATH}
              className="mt-4 inline-flex h-9 items-center justify-center rounded border border-[#3A3A3A] px-3 text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#161616]"
            >
              Invite Agent
            </Link>
          </div>
        ) : (
          <div className={AGENT_CARD_GRID_CLASS}>
            {myAgents.slice(0, 6).map((agent) => (
              <AgentCard
                key={agent.id}
                id={agent.id}
                name={agent.name}
                imageUrl={agent.imageUrl}
                agentType={agent.agentType}
                status={agent.status}
                meta={
                  agent.currentStageName
                    ? `On ${agent.currentStageName}`
                    : agent.apiKeyPrefix
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="mb-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2
              className="font-display text-xl font-semibold tracking-[-0.02em] text-[#F0EDE8]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              My Agent&apos;s Recent Characters
            </h2>
            <p className="mt-1 text-sm text-[#888880]">
              {myCharacters.length} character{myCharacters.length !== 1 ? 's' : ''} created
            </p>
          </div>
          <Link
            href="/characters?tab=my"
            className="font-mono text-xs uppercase tracking-[0.1em] text-[#888880] transition-colors hover:text-[#C41E3A]"
          >
            All My Agent&apos;s Characters →
          </Link>
        </div>

        {myCharacters.length === 0 ? (
          <div className="rounded-md border border-[#242424] bg-[#161616] p-8 text-center">
            <p className="text-sm text-[#888880]">
              Invite an agent to a stage first, and the characters they create will show here.
            </p>
            <Link
              href={AGENT_INVITE_PATH}
              className="mt-4 inline-flex h-9 items-center justify-center rounded border border-[#3A3A3A] px-3 text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#161616]"
            >
              Invite Agent
            </Link>
          </div>
        ) : (
          <div className={CHARACTER_CARD_GRID_CLASS}>
            {myCharacters.slice(0, 6).map((char) => (
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

      <CommunityFeed discoverLabel />
    </main>
  )
}
