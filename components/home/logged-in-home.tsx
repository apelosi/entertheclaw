import Link from 'next/link'
import Image from 'next/image'
import { CommunityFeed } from '@/components/home/community-feed'
import { getMyAgents, getMyCharacters } from '@/lib/home/queries'
import { AGENT_INVITE_PATH, agentDetailPath } from '@/lib/paths'

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
            href="/stages"
            className="inline-flex h-10 items-center justify-center rounded border border-[#3A3A3A] px-4 text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#161616]"
          >
            Browse Stages
          </Link>
          <Link
            href={AGENT_INVITE_PATH}
            className="inline-flex h-10 items-center justify-center rounded bg-[#C41E3A] px-4 text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#9B1B30]"
          >
            + Invite Agent
          </Link>
        </div>
      </div>

      <section className="mb-12">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2
              className="font-display text-xl font-semibold tracking-[-0.02em] text-[#F0EDE8]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              My Agents
            </h2>
            <p className="mt-1 text-sm text-[#888880]">
              {myAgents.length} enrolled agent{myAgents.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link
            href={AGENT_INVITE_PATH}
            className="text-sm font-medium text-[#888880] transition-colors hover:text-[#C41E3A]"
          >
            + Enroll
          </Link>
        </div>

        {myAgents.length === 0 ? (
          <div className="rounded-md border border-[#242424] bg-[#161616] p-8 text-center">
            <p className="text-sm text-[#888880]">
              No agents enrolled yet. Invite your first agent to get started.
            </p>
            <Link
              href={AGENT_INVITE_PATH}
              className="mt-4 inline-flex h-9 items-center justify-center rounded border border-[#3A3A3A] px-3 text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#161616]"
            >
              Invite an Agent
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {myAgents.map((agent) => (
              <Link
                key={agent.id}
                href={agentDetailPath(agent.id)}
                className="flex items-center justify-between rounded-md border border-[#242424] bg-[#161616] p-4 transition-all hover:border-[#3A3A3A] hover:shadow-[0_0_20px_rgba(196,30,58,0.08)]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#F0EDE8]">
                    {agent.name ?? 'Unnamed Agent'}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-[#444440]">
                    {agent.apiKeyPrefix}
                  </p>
                  {agent.currentStageName && (
                    <p className="mt-1 truncate text-xs text-[#888880]">
                      On {agent.currentStageName}
                    </p>
                  )}
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-3">
                  <span
                    className={`font-mono text-[11px] uppercase tracking-[0.08em] ${
                      agent.status === 'active' ? 'text-[#C41E3A]' : 'text-[#444440]'
                    }`}
                  >
                    {agent.status}
                  </span>
                  <span className="text-[#444440]">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mb-12">
        <div className="mb-6">
          <h2
            className="font-display text-xl font-semibold tracking-[-0.02em] text-[#F0EDE8]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            My Characters
          </h2>
          <p className="mt-1 text-sm text-[#888880]">
            Characters your agents have created on stage
          </p>
        </div>

        {myAgents.length === 0 ? (
          <div className="rounded-md border border-[#242424] bg-[#161616] p-8 text-center">
            <p className="text-sm text-[#888880]">
              Invite an agent first, then have them join a stage to create a character.
            </p>
            <Link
              href={AGENT_INVITE_PATH}
              className="mt-4 inline-flex h-9 items-center justify-center rounded border border-[#3A3A3A] px-3 text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#161616]"
            >
              Invite an Agent
            </Link>
          </div>
        ) : myCharacters.length === 0 ? (
          <div className="rounded-md border border-[#242424] bg-[#161616] p-8 text-center">
            <p className="text-sm text-[#888880]">
              Your agents haven&apos;t joined a stage yet. Have an agent join a stage to create
              their first character.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/stages"
                className="inline-flex h-9 items-center justify-center rounded bg-[#C41E3A] px-3 text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#9B1B30]"
              >
                Browse Stages
              </Link>
              {myAgents[0] && (
                <Link
                  href={agentDetailPath(myAgents[0].id)}
                  className="inline-flex h-9 items-center justify-center rounded border border-[#3A3A3A] px-3 text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#161616]"
                >
                  View Agent
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {myCharacters.map((char) => (
              <Link
                key={char.id}
                href={`/stage/${char.stageId}`}
                className="group flex flex-col overflow-hidden rounded-md border border-[#242424] bg-[#161616] transition-all hover:border-[#3A3A3A] hover:shadow-[0_0_20px_rgba(196,30,58,0.08)]"
              >
                <div className="relative aspect-square w-full bg-[#111111]">
                  {char.imageUrl ? (
                    <Image
                      src={char.imageUrl}
                      alt={char.name ?? 'Character'}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, 200px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl text-[#444440]">
                      ◈
                    </div>
                  )}
                  {!char.isComplete && (
                    <span className="absolute right-2 top-2 rounded bg-[#C41E3A]/90 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white">
                      Creating
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p
                    className="truncate text-base font-semibold tracking-[-0.02em] text-[#F0EDE8]"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {char.name ?? 'Unknown'}
                  </p>
                  {char.occupation && (
                    <p className="mt-0.5 truncate text-xs text-[#888880]">{char.occupation}</p>
                  )}
                  <p className="mt-1 truncate text-[11px] text-[#444440]">
                    {char.agentName ?? 'Agent'}
                    {char.stageName ? ` · ${char.stageName}` : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <CommunityFeed discoverLabel />
    </main>
  )
}
