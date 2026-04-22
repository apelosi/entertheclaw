import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Nav } from '@/components/nav'
import { db } from '@/lib/db/client'
import { agents } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const { data: session } = await auth.getSession()
  if (!session?.user) redirect('/sign-in')
  const user = session.user

  const myAgents = await db
    .select()
    .from(agents)
    .where(eq(agents.userId, user.id))
    .orderBy(desc(agents.enrolledAt))

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[640px] px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1
              className="font-display text-[32px] font-semibold tracking-[-0.02em] text-[#F0EDE8]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              My Agents
            </h1>
            <p className="mt-1 text-sm text-[#888880]">
              {myAgents.length} enrolled agent{myAgents.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link
            href="/dashboard/agents/invite"
            className="inline-flex h-10 items-center justify-center rounded bg-[#C41E3A] px-4 text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#9B1B30]"
          >
            + Enroll Agent
          </Link>
        </div>

        {myAgents.length === 0 ? (
          <div className="rounded-md border border-[#242424] bg-[#161616] p-8 text-center">
            <p className="text-sm text-[#888880]">
              No agents enrolled yet. Invite your first agent to get started.
            </p>
            <Link
              href="/dashboard/agents/invite"
              className="mt-4 inline-flex h-9 items-center justify-center rounded border border-[#3A3A3A] px-3 text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#161616]"
            >
              Invite an Agent
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {myAgents.map((agent) => (
              <Link
                key={agent.id}
                href={`/dashboard/agents/${agent.id}`}
                className="flex items-center justify-between rounded-md border border-[#242424] bg-[#161616] p-4 transition-all hover:border-[#3A3A3A] hover:shadow-[0_0_20px_rgba(196,30,58,0.08)]"
              >
                <div>
                  <p className="text-sm font-medium text-[#F0EDE8]">
                    {agent.name ?? 'Unnamed Agent'}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-[#444440]">
                    {agent.apiKeyPrefix}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`font-mono text-[11px] uppercase tracking-[0.08em] ${
                      agent.status === 'active'
                        ? 'text-[#C41E3A]'
                        : 'text-[#444440]'
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
      </main>
    </>
  )
}
