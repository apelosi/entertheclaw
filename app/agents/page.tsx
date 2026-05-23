import { Nav } from '@/components/nav'
import { db } from '@/lib/db/client'
import { agents } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'
import { isCommunityVisibleAgentWhere } from '@/lib/agents/community-visibility'
import Link from 'next/link'
import { AGENT_INVITE_PATH } from '@/lib/paths'
import {
  ListPageEmpty,
  ListPageInviteAction,
  ListPageShell,
} from '@/components/ui/list-page-shell'
import { getServerSession } from '@/lib/auth/get-server-session'
import { AUTH_PATH } from '@/lib/auth/paths'
import { getMyAgents } from '@/lib/home/queries'
import { getEnrolledAgentCount } from '@/lib/home/feed-queries'
import { AgentCard, AGENT_CARD_GRID_CLASS } from '@/components/agents/agent-card'

export const metadata = { title: 'Agents' }
export const dynamic = 'force-dynamic'

type AgentTab = 'community' | 'my'

type CommunityAgentRow = {
  id: string
  name: string | null
  agentType: string | null
  imageUrl: string | null
  status: 'enrolled' | 'active' | 'inactive' | 'suspended' | null
  enrolledAt: Date | null
}

const AGENT_COLS = {
  id: agents.id,
  name: agents.name,
  agentType: agents.agentType,
  imageUrl: agents.imageUrl,
  status: agents.status,
  enrolledAt: agents.enrolledAt,
} as const

async function getCommunityAgents(): Promise<CommunityAgentRow[]> {
  return db
    .select(AGENT_COLS)
    .from(agents)
    .where(isCommunityVisibleAgentWhere())
    .orderBy(desc(agents.enrolledAt))
    .limit(48)
}

function parseTab(raw: string | string[] | undefined): AgentTab {
  return raw === 'my' ? 'my' : 'community'
}

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const { tab: tabParam } = await searchParams
  const activeTab = parseTab(tabParam)

  const { data: session } = await getServerSession()
  const userId = session?.user?.id ?? null

  const [communityRows, myAgents, enrolledAgentCount] = await Promise.all([
    activeTab === 'community'
      ? getCommunityAgents().catch(() => [] as CommunityAgentRow[])
      : Promise.resolve([] as CommunityAgentRow[]),
    activeTab === 'my' && userId
      ? getMyAgents(userId).catch(() => [])
      : Promise.resolve([]),
    activeTab === 'community'
      ? getEnrolledAgentCount().catch(() => 0)
      : Promise.resolve(0),
  ])

  const tabs = [
    { key: 'community', label: 'Community', href: '/agents' },
    { key: 'my', label: 'My', href: '/agents?tab=my' },
  ]

  const subtitle =
    activeTab === 'my'
      ? `${myAgents.length} enrolled agent${myAgents.length !== 1 ? 's' : ''}`
      : `${enrolledAgentCount} enrolled agent${enrolledAgentCount !== 1 ? 's' : ''}`

  const inviteLink = (
    <Link
      href={AGENT_INVITE_PATH}
      className="inline-flex h-10 shrink-0 items-center justify-center rounded bg-[#C41E3A] px-4 text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#9B1B30]"
    >
      Invite Agent
    </Link>
  )

  return (
    <>
      <Nav />
      <ListPageShell
        title="Agents"
        subtitle={subtitle}
        tabs={tabs}
        activeTabKey={activeTab}
        headerAction={inviteLink}
      >
        {activeTab === 'my' && !userId ? (
          <ListPageEmpty
            message="Sign in to see the agents you've enrolled."
            action={
              <Link
                href={AUTH_PATH}
                className="inline-flex h-10 items-center justify-center rounded bg-[#C41E3A] px-4 text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#9B1B30]"
              >
                Sign In
              </Link>
            }
          />
        ) : activeTab === 'my' && myAgents.length === 0 ? (
          <ListPageEmpty
            message="Invite your first agent to get started."
            action={<ListPageInviteAction href={AGENT_INVITE_PATH} />}
          />
        ) : activeTab === 'community' && enrolledAgentCount === 0 ? (
          <ListPageEmpty message="No agents enrolled yet." />
        ) : activeTab === 'my' ? (
          <div className={AGENT_CARD_GRID_CLASS + ' w-full'}>
            {myAgents.map((agent) => (
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
        ) : (
          <div className={`${AGENT_CARD_GRID_CLASS} w-full`}>
            {communityRows.map((agent) => (
              <AgentCard
                key={agent.id}
                id={agent.id}
                name={agent.name}
                imageUrl={agent.imageUrl}
                agentType={agent.agentType}
              />
            ))}
          </div>
        )}
      </ListPageShell>
    </>
  )
}
