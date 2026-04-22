
import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { Nav } from '@/components/nav'
import { db } from '@/lib/db/client'
import { agents, characters, stageParticipants, stages } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import Link from 'next/link'
import type { Metadata } from 'next'

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
  const { data: session } = await auth.getSession()
  if (!session?.user) redirect('/sign-in')
  const user = session.user

  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, user.id)))
    .limit(1)

  if (!agent) notFound()

  // Current stage assignment
  const [currentParticipant] = await db
    .select({
      role: stageParticipants.role,
      stageId: stageParticipants.stageId,
      stageName: stages.name,
      joinedAt: stageParticipants.joinedAt,
    })
    .from(stageParticipants)
    .leftJoin(stages, eq(stages.id, stageParticipants.stageId))
    .where(eq(stageParticipants.agentId, agent.id))
    .limit(1)

  // Current character
  const [currentCharacter] = await db
    .select()
    .from(characters)
    .where(eq(characters.agentId, agent.id))
    .limit(1)

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[640px] px-6 py-10">
        <div className="mb-2">
          <Link
            href="/dashboard"
            className="text-sm text-[#888880] transition-colors hover:text-[#F0EDE8]"
          >
            ← My Agents
          </Link>
        </div>

        <div className="mb-8 mt-4">
          <h1
            className="font-display text-[32px] font-semibold tracking-[-0.02em] text-[#F0EDE8]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {agent.name ?? 'Unnamed Agent'}
          </h1>
          <p className="mt-1 font-mono text-xs text-[#444440]">{agent.apiKeyPrefix}</p>
        </div>

        {/* Status */}
        <section className="mb-6 rounded-md border border-[#242424] bg-[#161616] p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#888880]">
            Status
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

        {/* Stage assignment */}
        <section className="mb-6 rounded-md border border-[#242424] bg-[#161616] p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#888880]">
            Current Stage
          </h2>
          {currentParticipant ? (
            <div>
              <p className="text-sm font-medium text-[#F0EDE8]">
                {currentParticipant.stageName ?? currentParticipant.stageId}
              </p>
              <p className="mt-1 font-mono text-xs uppercase tracking-[0.08em] text-[#444440]">
                Role: {currentParticipant.role}
              </p>
              <Link
                href={`/stage/${currentParticipant.stageId}`}
                className="mt-3 inline-flex h-8 items-center justify-center rounded border border-[#3A3A3A] px-3 text-xs font-medium text-[#F0EDE8] transition-colors hover:bg-[#161616]"
              >
                View Stage →
              </Link>
            </div>
          ) : (
            <p className="text-sm text-[#888880]">Not currently on a stage.</p>
          )}
        </section>

        {/* Character */}
        {currentCharacter && (
          <section className="mb-6 rounded-md border border-[#242424] bg-[#161616] p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#888880]">
              Active Character
            </h2>
            <p
              className="font-display text-xl font-semibold tracking-[-0.02em] text-[#F0EDE8]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {currentCharacter.name ?? 'Unnamed'}
            </p>
            {currentCharacter.occupation && (
              <p className="mt-1 text-sm text-[#888880]">{currentCharacter.occupation}</p>
            )}
          </section>
        )}
      </main>
    </>
  )
}
