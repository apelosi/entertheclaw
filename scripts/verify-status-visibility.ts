/**
 * Verify the status-visibility changes against a real database:
 *   - community-visibility no longer filters by status (idle/inactive agents
 *     now show), but still correctly excludes test-tagged data
 *   - a character's status mirrors its owning agent's while live
 *   - unenrolling flips the agent to 'unenrolled' and the character to
 *     'retired' (no longer idle/active/inactive)
 *
 * Usage: VERIFY_ALLOW_DB_WRITES=1 bunx tsx scripts/verify-status-visibility.ts
 */
import './verify-turn-open-guard'
import 'dotenv/config'
import { db } from '@/lib/db/client'
import { agents, stageParticipants, stages, stageEvents, characters, archivedCharacters } from '@/lib/db/schema'
import { eq, inArray, and } from 'drizzle-orm'
import { generateApiKey, hashApiKey, getApiKeyPrefix } from '@/lib/api/agent-auth'
import { isCommunityVisibleAgentWhere } from '@/lib/agents/community-visibility'
import { enrollAgentOnStage, unenrollAgentFromStage } from '@/lib/stages/enrollment'
import { getCharactersWithStatus } from '@/lib/characters/character-listing'

const VERIFY_TAG = `verify-status-${Date.now()}`

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
      name: 'Verify Status Agent',
      status: 'unenrolled',
    })
    .returning()

  const [stage] = await db
    .insert(stages)
    .values({ name: `${VERIFY_TAG}-stage`, theme: 'drama' })
    .returning({ id: stages.id })

  // A SEPARATE agent whose userId/name deliberately do NOT match the
  // verify-%/smoke-test-user/verifyagent%/smoketestagent% test-exclusion
  // patterns — needed to isolate "status no longer filters community
  // visibility" from "test-tagged data is still excluded" (a tagged agent
  // would be excluded by the OTHER filter regardless of status, making that
  // assertion untestable with the main tagged agent above). Tracked for
  // cleanup by direct id, not by tag.
  const untaggedRawKey = generateApiKey()
  const [untaggedAgent] = await db
    .insert(agents)
    .values({
      userId: `status-visibility-check-${Date.now()}`,
      apiKeyHash: hashApiKey(untaggedRawKey),
      apiKeyPrefix: getApiKeyPrefix(untaggedRawKey),
      name: 'Status Visibility Check Agent',
      status: 'idle',
    })
    .returning()

  try {
    // --- fresh enroll -> character live, status mirrors agent's fresh 'active' ---
    const enrollResult = await enrollAgentOnStage({
      agentId: agent.id,
      agentName: agent.name,
      stageId: stage.id,
    })
    check('fresh enroll succeeded', enrollResult.ok, enrollResult)

    const [agentAfterEnroll] = await db.select({ status: agents.status }).from(agents).where(eq(agents.id, agent.id))
    check('fresh enroll promotes agent to active', agentAfterEnroll?.status === 'active', agentAfterEnroll)

    let myChars = await getCharactersWithStatus({ userId: VERIFY_TAG })
    check('character listing shows exactly 1 character (live)', myChars.length === 1, myChars)
    check('live character status mirrors agent (active)', myChars[0]?.status === 'active' && myChars[0]?.isArchived === false, myChars[0])

    // --- untagged idle agent: community-visibility must now include it ---
    const communityRows = await db.select({ id: agents.id }).from(agents).where(isCommunityVisibleAgentWhere())
    check(
      'community-visibility now includes an idle agent (previously excluded)',
      communityRows.some((r) => r.id === untaggedAgent.id),
      communityRows.map((r) => r.id),
    )

    // --- simulate the sync job marking the TAGGED agent idle too, for the
    // character-listing mirroring checks below ---
    await db.update(agents).set({ status: 'idle' }).where(eq(agents.id, agent.id))

    myChars = await getCharactersWithStatus({ userId: VERIFY_TAG })
    check('live character status now mirrors idle', myChars[0]?.status === 'idle', myChars[0])

    // --- community view (no userId) must still EXCLUDE this test-tagged agent ---
    const communityChars = await getCharactersWithStatus({})
    check(
      'community character listing excludes the test-tagged agent (verify-% pattern)',
      !communityChars.some((c) => c.id === myChars[0]?.id),
      communityChars.length,
    )

    // --- unenroll: agent -> unenrolled, character -> retired ---
    const unenrollResult = await unenrollAgentFromStage({ agentId: agent.id, stageId: stage.id, reason: 'user_pulled' })
    check('unenroll archived the character', unenrollResult.archivedCharacterId != null, unenrollResult)

    const [agentAfterUnenroll] = await db.select({ status: agents.status }).from(agents).where(eq(agents.id, agent.id))
    check('unenrolled agent status -> unenrolled', agentAfterUnenroll?.status === 'unenrolled', agentAfterUnenroll)

    myChars = await getCharactersWithStatus({ userId: VERIFY_TAG })
    check('character now retired, marked archived, still visible', myChars.length === 1, myChars)
    check(
      'retired character has status=retired, isArchived=true',
      myChars[0]?.status === 'retired' && myChars[0]?.isArchived === true,
      myChars[0],
    )
  } finally {
    await db.delete(stageEvents).where(eq(stageEvents.stageId, stage.id))
    await db.delete(characters).where(eq(characters.stageId, stage.id))
    await db.delete(archivedCharacters).where(eq(archivedCharacters.stageId, stage.id))
    await db.delete(stageParticipants).where(eq(stageParticipants.agentId, agent.id))
    await db.delete(stages).where(eq(stages.id, stage.id))
    await db.delete(agents).where(inArray(agents.id, [agent.id, untaggedAgent.id]))
    console.log('[cleanup] done')
  }

  console.log(fail === 0 ? `\nAll ${pass} checks passed.` : `\n${fail} of ${pass + fail} checks FAILED.`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
