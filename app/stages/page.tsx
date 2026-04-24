import Link from 'next/link'
import { Nav } from '@/components/nav'
import { StageCard } from '@/components/stage/stage-card'
import { db } from '@/lib/db/client'
import { stages, stageParticipants, stageEvents } from '@/lib/db/schema'
import { eq, and, count, desc } from 'drizzle-orm'

export const metadata = { title: 'Stages' }
export const revalidate = 30

async function getAllStages() {
  const allStages = await db.select().from(stages).where(eq(stages.isActive, true))

  return Promise.all(
    allStages.map(async (stage) => {
      const [participantCount] = await db
        .select({ count: count() })
        .from(stageParticipants)
        .where(eq(stageParticipants.stageId, stage.id))

      const recentEvents = await db
        .select()
        .from(stageEvents)
        .where(and(eq(stageEvents.stageId, stage.id), eq(stageEvents.type, 'dialogue')))
        .orderBy(desc(stageEvents.createdAt))
        .limit(1)

      const lastLine =
        recentEvents[0] &&
        typeof recentEvents[0].content === 'object' &&
        recentEvents[0].content !== null
          ? (recentEvents[0].content as Record<string, unknown>).text as string | undefined
          : undefined

      return { ...stage, participantCount: participantCount?.count ?? 0, lastLine }
    })
  )
}

export default async function StagesPage() {
  const allStages = await getAllStages().catch(() => [])

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[1280px] px-6 py-10">
        <div className="mb-8">
          <h1
            className="font-display text-[40px] font-semibold tracking-[-0.02em] text-[#F0EDE8]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            All Stages
          </h1>
          <p className="mt-2 text-sm text-[#888880]">
            {allStages.length} active stage{allStages.length !== 1 ? 's' : ''} — 24/7 live
            performance
          </p>
        </div>

        {allStages.length === 0 ? (
          <p className="text-sm text-[#888880]">No active stages.</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {allStages.map((stage) => (
              <StageCard
                key={stage.id}
                id={stage.id}
                name={stage.name}
                theme={stage.theme}
                description={stage.description ?? undefined}
                participantCount={Number(stage.participantCount)}
                lastLine={stage.lastLine}
              />
            ))}
          </div>
        )}

        <div className="mt-16 border-t border-[#242424] pt-10">
          <h2 className="mb-3 font-ui text-lg font-semibold text-[#F0EDE8]">
            Want to build a stage?
          </h2>
          <p className="mb-5 text-sm text-[#888880]">
            Stage builds are gated and reviewed. Submit your idea and we&apos;ll reach out.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center justify-center rounded border border-[#3A3A3A] px-4 text-sm font-medium transition-colors bg-transparent text-[#F0EDE8] hover:bg-[#161616]"
          >
            Go to Dashboard
          </Link>
        </div>
      </main>
    </>
  )
}
