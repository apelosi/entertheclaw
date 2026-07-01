/**
 * Verify the stageParticipants agentId-unique constraint actually prevents
 * an agent from ending up live on two stages at once under a real race —
 * two concurrent enrollAgentOnStage() calls for the same agent on two
 * different stages, fired via Promise.all (no artificial delay/mock; this
 * hits the real database and lets Postgres's own constraint resolve the
 * race, exactly as it would between a human's PUT reassignment and the
 * agent's own concurrent join() retry).
 *
 * Usage: VERIFY_ALLOW_DB_WRITES=1 bunx tsx scripts/verify-stage-agent-unique-race.ts
 *
 * Creates its own scratch agent + 2 stages tagged with a unique verify tag
 * and cleans them up in a finally block. Orphans: bun run db:cleanup-verify-agents
 */
import './verify-turn-open-guard'
import 'dotenv/config'
import { db } from '@/lib/db/client'
import { agents, stageParticipants, stages, characters, stageEvents } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { generateApiKey, hashApiKey, getApiKeyPrefix } from '@/lib/api/agent-auth'
import { enrollAgentOnStage } from '@/lib/stages/enrollment'

const VERIFY_TAG = `verify-race-${Date.now()}`

let pass = 0
let fail = 0

function check(label: string, cond: boolean, detail?: unknown) {
  if (cond) {
    pass++
    console.log(`  ✓ ${label}`)
  } else {
    fail++
    console.error(`  ✗ ${label}`)
    if (detail !== undefined) console.error('    detail:', JSON.stringify(detail, null, 2))
  }
}

async function main() {
  const rawKey = generateApiKey()
  const [agent] = await db
    .insert(agents)
    .values({
      userId: VERIFY_TAG,
      apiKeyHash: hashApiKey(rawKey),
      apiKeyPrefix: getApiKeyPrefix(rawKey),
      name: 'Verify Race Agent',
      status: 'active',
    })
    .returning({ id: agents.id })

  const [stageA, stageB] = await Promise.all([
    db.insert(stages).values({ name: `${VERIFY_TAG}-A`, theme: 'drama' }).returning({ id: stages.id }),
    db.insert(stages).values({ name: `${VERIFY_TAG}-B`, theme: 'drama' }).returning({ id: stages.id }),
  ]).then(([a, b]) => [a[0], b[0]])

  try {
    console.log(`[setup] agent=${agent.id.slice(0, 8)} stageA=${stageA.id.slice(0, 8)} stageB=${stageB.id.slice(0, 8)}`)

    // The actual race: fire both enrolls concurrently, no ordering guarantee.
    const [resultA, resultB] = await Promise.all([
      enrollAgentOnStage({ agentId: agent.id, agentName: 'Verify Race Agent', stageId: stageA.id }),
      enrollAgentOnStage({ agentId: agent.id, agentName: 'Verify Race Agent', stageId: stageB.id }),
    ])
    const tagged = [
      { stageId: stageA.id, result: resultA },
      { stageId: stageB.id, result: resultB },
    ]
    const succeeded = tagged.filter((t) => t.result.ok)
    const failed = tagged.filter((t) => !t.result.ok)

    check('exactly one enroll succeeded', succeeded.length === 1, tagged)
    check(
      'the other failed with agent_already_on_another_stage',
      failed.length === 1 && !failed[0].result.ok && failed[0].result.error.kind === 'agent_already_on_another_stage',
      failed,
    )

    const liveRows = await db
      .select({ stageId: stageParticipants.stageId })
      .from(stageParticipants)
      .where(eq(stageParticipants.agentId, agent.id))

    check('exactly one live stageParticipants row exists for the agent', liveRows.length === 1, liveRows)
    check(
      'the surviving row is on the stage whose enroll actually succeeded',
      liveRows.length === 1 && succeeded.length === 1 && liveRows[0].stageId === succeeded[0].stageId,
      { liveRows, succeeded },
    )
  } finally {
    // stageEvents (the 'joined' event from the successful enroll) references
    // stages too — must go before deleting the stages themselves.
    await db.delete(stageEvents).where(inArray(stageEvents.stageId, [stageA.id, stageB.id]))
    await db.delete(characters).where(inArray(characters.stageId, [stageA.id, stageB.id]))
    await db.delete(stageParticipants).where(eq(stageParticipants.agentId, agent.id))
    await db.delete(stages).where(inArray(stages.id, [stageA.id, stageB.id]))
    await db.delete(agents).where(eq(agents.id, agent.id))
    console.log('[cleanup] done')
  }

  console.log(fail === 0 ? `\nAll ${pass} checks passed.` : `\n${fail} of ${pass + fail} checks FAILED.`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
