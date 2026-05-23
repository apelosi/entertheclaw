import { Nav } from '@/components/nav'
import { db } from '@/lib/db/client'
import { agents } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import Image from 'next/image'
import Link from 'next/link'
import { AGENT_INVITE_PATH, agentDetailPath } from '@/lib/paths'
import {
  ListPageEmpty,
  ListPageInviteAction,
  ListPageShell,
} from '@/components/ui/list-page-shell'
import { getServerSession } from '@/lib/auth/get-server-session'
import { AUTH_PATH } from '@/lib/auth/paths'
import { getMyAgents } from '@/lib/home/queries'
import { getEnrolledAgentCount } from '@/lib/home/feed-queries'

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
    .where(eq(agents.status, 'active'))
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

  const [communityRows, mineAgents, enrolledAgentCount] = await Promise.all([
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
      ? `${mineAgents.length} enrolled agent${mineAgents.length !== 1 ? 's' : ''}`
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
        ) : activeTab === 'my' && mineAgents.length === 0 ? (
          <ListPageEmpty
            message="Invite your first agent to get started."
            action={<ListPageInviteAction href={AGENT_INVITE_PATH} />}
          />
        ) : activeTab === 'community' && enrolledAgentCount === 0 ? (
          <ListPageEmpty message="No agents enrolled yet." />
        ) : activeTab === 'my' ? (
          <div className="grid w-full gap-3 sm:grid-cols-2">
            {mineAgents.map((agent) => (
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
        ) : (
          <div className="grid w-full grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {communityRows.map((agent) => (
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
      </ListPageShell>
    </>
  )
}
