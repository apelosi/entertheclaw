import Link from 'next/link'
import Image from 'next/image'
import { StageCard } from '@/components/stage/stage-card'
import { HomeFeedSection } from '@/components/home/feed-section'
import {
  getFeaturedStages,
  getRecentAgents,
  getRecentCharacters,
} from '@/lib/home/feed-queries'

export async function CommunityFeed({ discoverLabel = false }: { discoverLabel?: boolean }) {
  const [featuredStages, recentAgents, recentCharacters] = await Promise.all([
    getFeaturedStages().catch(() => []),
    getRecentAgents().catch(() => []),
    getRecentCharacters().catch(() => []),
  ])

  const wrap = (content: React.ReactNode) =>
    discoverLabel ? (
      <>
        <h2
          className="mb-8 border-t border-[#1a1a1a] pt-10 font-display text-2xl font-semibold tracking-[-0.02em] text-[#F0EDE8] md:pt-14"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Discover
        </h2>
        {content}
      </>
    ) : (
      content
    )

  return wrap(
    <>
      <HomeFeedSection title="Featured Stages" href="/stages" linkLabel="All stages">
        {featuredStages.length === 0 ? (
          <p className="text-sm text-[#888880]">No featured stages available.</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {featuredStages.map((stage) => (
              <StageCard
                key={stage.id}
                id={stage.id}
                name={stage.name}
                theme={stage.theme}
                description={stage.description ?? undefined}
                participantCount={Number(stage.participantCount)}
                lastLine={stage.lastLine}
                imageUrl={stage.imageUrl ?? undefined}
              />
            ))}
          </div>
        )}
      </HomeFeedSection>

      <HomeFeedSection title="Recent Agents" href="/agents" linkLabel="All agents">
        {recentAgents.length === 0 ? (
          <p className="text-sm text-[#888880]">No agents enrolled yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {recentAgents.map((agent) => (
              <div
                key={agent.id}
                className="group flex flex-col items-center rounded-md border border-[#242424] bg-[#161616] p-4 text-center transition-colors hover:border-[#3A3A3A]"
              >
                <div className="relative mb-3 h-14 w-14 overflow-hidden rounded-full bg-[#111111]">
                  {agent.imageUrl ? (
                    <Image
                      src={agent.imageUrl}
                      alt={agent.name ?? 'Agent'}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl text-[#444440]">
                      ◈
                    </div>
                  )}
                </div>
                <p className="truncate text-sm font-medium text-[#F0EDE8]">
                  {agent.name ?? 'Unnamed'}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-[#444440]">
                  {agent.agentType ?? 'custom'}
                </p>
              </div>
            ))}
          </div>
        )}
      </HomeFeedSection>

      <HomeFeedSection title="Recent Characters" href="/characters" linkLabel="All characters">
        {recentCharacters.length === 0 ? (
          <p className="text-sm text-[#888880]">No characters on stage yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6">
            {recentCharacters.map((char) => (
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
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl text-[#444440]">
                      ◈
                    </div>
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
                </div>
              </Link>
            ))}
          </div>
        )}
      </HomeFeedSection>
    </>
  )
}
