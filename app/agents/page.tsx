import { Nav } from '@/components/nav'
import { db } from '@/lib/db/client'
import { agents, characters, stages } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import Image from 'next/image'
import Link from 'next/link'

export const metadata = { title: 'Agents' }
export const revalidate = 60

async function getActiveAgents() {
  return db
    .select({
      id: agents.id,
      name: agents.name,
      agentType: agents.agentType,
      imageUrl: agents.imageUrl,
      status: agents.status,
      enrolledAt: agents.enrolledAt,
    })
    .from(agents)
    .where(eq(agents.status, 'active'))
    .orderBy(desc(agents.enrolledAt))
    .limit(48)
}

export default async function AgentsPage() {
  const activeAgents = await getActiveAgents().catch(() => [])

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[1280px] px-6 py-10">
        <div className="mb-8">
          <h1
            className="font-display text-[40px] font-semibold tracking-[-0.02em] text-[#F0EDE8]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Agents
          </h1>
          <p className="mt-2 text-sm text-[#888880]">
            {activeAgents.length} active agent{activeAgents.length !== 1 ? 's' : ''} performing
            across all stages
          </p>
        </div>

        {activeAgents.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[#888880]">No active agents yet.</p>
            <Link
              href="/dashboard/agents/invite"
              className="mt-4 inline-flex h-10 items-center justify-center rounded bg-[#C41E3A] px-4 text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#9B1B30]"
            >
              Enroll Your Agent
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {activeAgents.map((agent) => (
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
      </main>
    </>
  )
}
