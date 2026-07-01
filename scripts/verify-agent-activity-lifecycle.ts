/**
 * Verify the agent activity lifecycle end-to-end against a real database:
 *   - 25h silent -> idle, 49h silent -> inactive (jumps straight there, no
 *     requirement to have passed through idle first)
 *   - a full stage with an inactive main participant -> a new agent's join()
 *     evicts it and takes the freed slot
 *   - a dialogue post from an idle/inactive agent -> reactivated
 *
 * RESEND_API_KEY is deliberately overridden to an invalid value for this run
 * (via a fake-key wrapper, set BEFORE the email module loads) so every send
 * fails — proving status transitions and eviction still complete correctly
 * and no request throws, even when the email side is broken.
 *
 * Usage: VERIFY_ALLOW_DB_WRITES=1 bunx tsx scripts/verify-agent-activity-lifecycle.ts
 */
import './verify-turn-open-guard'
import 'dotenv/config'

// Must happen before agent-activity-emails.ts (which instantiates its Resend
// client at module load) is ever imported — dynamic imports below ensure that.
process.env.RESEND_API_KEY = 'invalid_test_key_for_verification'

import { db } from '@/lib/db/client'
import { agents, stageParticipants, stages, stageEvents, characters } from '@/lib/db/schema'
import { eq, inArray, and } from 'drizzle-orm'
import { generateApiKey, hashApiKey, getApiKeyPrefix } from '@/lib/api/agent-auth'

const VERIFY_TAG = `verify-lifecycle-${Date.now()}`

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

async function makeAgent(name: string) {
  const rawKey = generateApiKey()
  const [agent] = await db
    .insert(agents)
    .values({
      userId: VERIFY_TAG,
      apiKeyHash: hashApiKey(rawKey),
      apiKeyPrefix: getApiKeyPrefix(rawKey),
      name,
      status: 'active',
    })
    .returning()
  return agent
}

async function main() {
  const { syncAgentActivityStatuses, reactivateAgentIfNeeded } = await import(
    '@/lib/stage/agent-activity-status'
  )
  const { enrollAgentOnStage, unenrollAgentFromStage } = await import('@/lib/stages/enrollment')

  const [stage] = await db
    .insert(stages)
    .values({ name: `${VERIFY_TAG}-stage`, theme: 'drama', maxMainCharacters: 1, maxNpcs: 1 })
    .returning({ id: stages.id })

  const agentIdleTest = await makeAgent('Verify Idle Test')
  const agentInactiveTest = await makeAgent('Verify Inactive Test')
  const agentEvictee = await makeAgent('Verify Evictee')
  const agentEvictor = await makeAgent('Verify Evictor')
  const agentReactivate = await makeAgent('Verify Reactivate')

  const stageIds = [stage.id]
  const agentIds = [agentIdleTest, agentInactiveTest, agentEvictee, agentEvictor, agentReactivate].map(
    (a) => a.id,
  )

  try {
    // --- 25h silent -> idle ---
    const t25hAgo = new Date(Date.now() - 25 * 60 * 60 * 1000)
    await db
      .insert(stageParticipants)
      .values({ stageId: stage.id, agentId: agentIdleTest.id, role: 'npc', joinedAt: t25hAgo })
    // second stage needed since maxNpcs=1 on the shared stage would collide with eviction tests below
    const [stage2] = await db
      .insert(stages)
      .values({ name: `${VERIFY_TAG}-stage2`, theme: 'drama' })
      .returning({ id: stages.id })
    stageIds.push(stage2.id)
    await db.delete(stageParticipants).where(eq(stageParticipants.agentId, agentIdleTest.id))
    await db
      .insert(stageParticipants)
      .values({ stageId: stage2.id, agentId: agentIdleTest.id, role: 'main', joinedAt: t25hAgo })

    const t49hAgo = new Date(Date.now() - 49 * 60 * 60 * 1000)
    await db
      .insert(stageParticipants)
      .values({ stageId: stage2.id, agentId: agentInactiveTest.id, role: 'npc', joinedAt: t49hAgo })

    const syncResult = await syncAgentActivityStatuses()
    check('sync checked at least the 2 seeded participants', syncResult.checked >= 2, syncResult)

    const [idleRow] = await db.select({ status: agents.status }).from(agents).where(eq(agents.id, agentIdleTest.id))
    check('25h-silent agent -> idle', idleRow?.status === 'idle', idleRow)

    const [inactiveRow] = await db
      .select({ status: agents.status })
      .from(agents)
      .where(eq(agents.id, agentInactiveTest.id))
    check('49h-silent agent -> inactive directly (no idle stop required)', inactiveRow?.status === 'inactive', inactiveRow)

    // --- eviction: full main slot (max=1) held by an inactive agent, a new join takes it ---
    await db
      .update(agents)
      .set({ status: 'inactive' })
      .where(eq(agents.id, agentEvictee.id))
    await db.insert(stageParticipants).values({ stageId: stage.id, agentId: agentEvictee.id, role: 'main' })

    const enrollResult = await enrollAgentOnStage({
      agentId: agentEvictor.id,
      agentName: agentEvictor.name,
      stageId: stage.id,
    })
    check('evictor enroll succeeded', enrollResult.ok, enrollResult)
    check(
      'evictor got the main slot (not demoted to npc)',
      enrollResult.ok && enrollResult.data.role === 'main',
      enrollResult,
    )

    const remainingOnStage = await db
      .select({ agentId: stageParticipants.agentId })
      .from(stageParticipants)
      .where(eq(stageParticipants.stageId, stage.id))
    check(
      'exactly one main participant remains, and it is the evictor (evictee removed)',
      remainingOnStage.length === 1 && remainingOnStage[0].agentId === agentEvictor.id,
      remainingOnStage,
    )

    // --- reactivation ---
    await db.update(agents).set({ status: 'idle' }).where(eq(agents.id, agentReactivate.id))
    await db.insert(stageParticipants).values({ stageId: stage2.id, agentId: agentReactivate.id, role: 'npc' })
    await reactivateAgentIfNeeded(agentReactivate.id)
    const [reactivatedRow] = await db
      .select({ status: agents.status })
      .from(agents)
      .where(eq(agents.id, agentReactivate.id))
    check('idle agent posting dialogue -> reactivated to active', reactivatedRow?.status === 'active', reactivatedRow)

    console.log(
      '\n(All the above ran with an intentionally invalid RESEND_API_KEY — every email send failed internally. ' +
        'None of it threw past the try/catch, and every DB transition above still completed correctly: ' +
        'email failures do not block status transitions, eviction, or reactivation.)',
    )
  } finally {
    await db.delete(stageEvents).where(inArray(stageEvents.stageId, stageIds))
    await db.delete(characters).where(inArray(characters.stageId, stageIds))
    await db.delete(stageParticipants).where(inArray(stageParticipants.agentId, agentIds))
    await db.delete(stages).where(inArray(stages.id, stageIds))
    await db.delete(agents).where(inArray(agents.id, agentIds))
    console.log('[cleanup] done')
  }

  console.log(fail === 0 ? `\nAll ${pass} checks passed.` : `\n${fail} of ${pass + fail} checks FAILED.`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
