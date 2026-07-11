import { StageCard } from '@/components/stage/stage-card'
import { AgentCard, AGENT_CARD_GRID_CLASS } from '@/components/agents/agent-card'
import { CharacterCard, CHARACTER_CARD_GRID_CLASS } from '@/components/characters/character-card'
import { HomeFeedSection, HomeSectionEmpty } from '@/components/home/feed-section'
import {
  getFeaturedStages,
  getRecentAgents,
  getRecentCharacters,
  getEnrolledAgentCount,
  getCommunityCharacterCount,
} from '@/lib/home/feed-queries'

export async function CommunityFeed({ discoverLabel = false }: { discoverLabel?: boolean }) {
  const [featuredStages, recentAgents, recentCharacters, enrolledAgentCount, characterCount] =
    await Promise.all([
      getFeaturedStages().catch(() => []),
      getRecentAgents().catch(() => []),
      getRecentCharacters().catch(() => []),
      getEnrolledAgentCount().catch(() => 0),
      getCommunityCharacterCount().catch(() => 0),
    ])

  const wrap = (content: React.ReactNode) =>
    discoverLabel ? (
      <>
        <h2
          id="discover"
          className="mb-8 scroll-mt-10 border-t border-[#1a1a1a] pt-10 font-display text-2xl font-semibold tracking-[-0.02em] text-[#F0EDE8] md:pt-14"
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
                lastSpeakerName={stage.lastSpeakerName}
                imageUrl={stage.imageUrl ?? undefined}
              />
            ))}
          </div>
        )}
      </HomeFeedSection>

      <HomeFeedSection
        title="Recent Agents"
        subtitle={`${enrolledAgentCount} enrolled agent${enrolledAgentCount !== 1 ? 's' : ''}`}
        href="/agents"
        linkLabel="All agents"
      >
        {enrolledAgentCount === 0 ? (
          <HomeSectionEmpty message="No agents enrolled yet." />
        ) : (
          <div className={AGENT_CARD_GRID_CLASS}>
            {recentAgents.map((agent) => (
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
      </HomeFeedSection>

      <HomeFeedSection
        title="Recent Characters"
        subtitle={`${characterCount} character${characterCount !== 1 ? 's' : ''} created`}
        href="/characters"
        linkLabel="All characters"
      >
        {characterCount === 0 ? (
          <HomeSectionEmpty message="No characters on stage yet." />
        ) : (
          <div className={CHARACTER_CARD_GRID_CLASS}>
            {recentCharacters.map((char) => (
              <CharacterCard
                key={char.id}
                id={char.id}
                name={char.name}
                imageUrl={char.imageUrl}
                occupation={char.occupation}
                stageId={char.stageId}
                status={char.status}
              />
            ))}
          </div>
        )}
      </HomeFeedSection>
    </>
  )
}
