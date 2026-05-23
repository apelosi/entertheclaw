/**
 * Verify the turn_open snapshot push-channel implementation.
 *
 * Exercises every emit path against a clean test stage and asserts the
 * resulting `turn_open` events carry the canonical snapshot with the
 * correct reason, dedupe behavior, and active-grant queuing.
 *
 * Usage: `VERIFY_ALLOW_DB_WRITES=1 bun tsx scripts/verify-turn-open-snapshot.ts`
 *
 * Requires:
 *   - VERIFY_ALLOW_DB_WRITES=1 (explicit approval — inserts test agents/stages)
 *   - dev server running on http://localhost:3000 (override via VERIFY_API_URL)
 *   - .env.local with DATABASE_URL (for setup/cleanup/asserts)
 *
 * The script creates its own scratch stage + agents tagged with a unique
 * verifyRunId and cleans them up in a finally block. Orphans:
 * `bun run db:cleanup-verify-agents`
 */
import './verify-turn-open-guard'
import 'dotenv/config'
import {
  db,
} from '../lib/db/client'
import {
  agents,
  characters,
  stageEvents,
  stageParticipants,
  stages,
} from '../lib/db/schema'
import {
  and,
  desc,
  eq,
  inArray,
  like,
  or,
} from 'drizzle-orm'
import {
  generateApiKey,
  hashApiKey,
  getApiKeyPrefix,
} from '../lib/api/agent-auth'
import { emitTurnOpen, stageNeedsSafetyNetTurnOpen } from '../lib/stage/emit-turn-open'
import { buildTurnOpenSnapshot } from '../lib/stage/build-turn-open-snapshot'
import type { TurnOpenContent } from '../lib/stage/emit-turn-open'
import crypto from 'node:crypto'

const API_BASE = process.env.VERIFY_API_URL ?? 'http://localhost:3000/api/v1'
const VERIFY_TAG = `verify-turn-open-${Date.now()}`

let runStageId: string | null = null
let runAgentIds: string[] = []

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

let pass = 0
let fail = 0
const failures: string[] = []

function check(label: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    pass += 1
    console.log(`  ✓ ${label}`)
  } else {
    fail += 1
    failures.push(label)
    console.error(`  ✗ ${label}`)
    if (detail !== undefined) {
      console.error('    detail:', JSON.stringify(detail, null, 2))
    }
  }
}

interface BootstrappedAgent {
  id: string
  apiKey: string
  name: string
}

async function bootstrapAgent(name: string): Promise<BootstrappedAgent> {
  const rawKey = generateApiKey()
  const [row] = await db
    .insert(agents)
    .values({
      userId: VERIFY_TAG,
      apiKeyHash: hashApiKey(rawKey),
      apiKeyPrefix: getApiKeyPrefix(rawKey),
      name,
      agentType: 'custom',
      status: 'active',
    })
    .returning({ id: agents.id })
  return { id: row.id, apiKey: rawKey, name }
}

async function createTestStage(): Promise<string> {
  const [row] = await db
    .insert(stages)
    .values({
      name: `[verify-turn-open] ${VERIFY_TAG}`,
      theme: 'scifi',
      description: 'Scratch stage for turn_open verification.',
      initialSceneName: 'The Verification Chamber',
      initialSceneDescription:
        'A sterile testing space. Hum of diagnostics. Two operatives present.',
      isActive: true,
      createdByUserId: VERIFY_TAG,
    })
    .returning({ id: stages.id })
  return row.id
}

interface HttpOpts {
  apiKey?: string
  body?: unknown
  /** ms — default 90s to absorb Next.js cold-route compile times in dev */
  timeoutMs?: number
}

async function http(
  method: 'GET' | 'POST',
  path: string,
  opts: HttpOpts = {},
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`
  const ac = new AbortController()
  const timeoutMs = opts.timeoutMs ?? 90_000
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: ac.signal,
    })
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      body = null
    }
    return { status: res.status, body }
  } catch (err) {
    throw new Error(
      `${method} ${path} failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Hit a route once with an intentionally-invalid auth to trigger Next.js dev
 * to compile it. We don't care about the response; the goal is to get the
 * route warm before tests with tight timing assumptions run.
 */
async function prewarm(path: string): Promise<void> {
  try {
    await http('POST', path, {
      apiKey: 'etc_live_prewarm_will_401',
      body: {},
      timeoutMs: 120_000,
    })
  } catch (err) {
    console.warn(`  [prewarm] ${path}: ${err instanceof Error ? err.message : err}`)
  }
}

async function joinStage(stageId: string, agent: BootstrappedAgent) {
  const r = await http('POST', `/stages/${stageId}/join`, {
    apiKey: agent.apiKey,
    body: { name: agent.name },
  })
  if (r.status !== 200) {
    throw new Error(`join failed for ${agent.name}: ${r.status} ${JSON.stringify(r.body)}`)
  }
  return r.body as { ok: true; characterId: string; role: 'main' | 'npc' }
}

async function turnOpenEventsFor(stageId: string) {
  return db
    .select()
    .from(stageEvents)
    .where(
      and(
        eq(stageEvents.stageId, stageId),
        eq(stageEvents.type, 'turn_open'),
      ),
    )
    .orderBy(desc(stageEvents.createdAt))
}

async function latestTurnOpen(stageId: string) {
  const rows = await turnOpenEventsFor(stageId)
  return rows[0] ?? null
}

function snapshotOf(evt: { content: unknown }): TurnOpenContent | null {
  if (!evt.content || typeof evt.content !== 'object') return null
  return evt.content as TurnOpenContent
}

async function cleanup(stageId: string | null, agentIds: string[], verifyTag: string) {
  console.log('\n[cleanup]')
  try {
    if (stageId) {
      await db
        .delete(stageEvents)
        .where(eq(stageEvents.stageId, stageId))
      await db
        .delete(stageParticipants)
        .where(eq(stageParticipants.stageId, stageId))
      await db
        .delete(characters)
        .where(eq(characters.stageId, stageId))
      await db.delete(stages).where(eq(stages.id, stageId))
    }
    if (agentIds.length > 0) {
      await db.delete(agents).where(inArray(agents.id, agentIds))
    }
    const orphanStages = await db
      .select({ id: stages.id })
      .from(stages)
      .where(
        or(eq(stages.createdByUserId, verifyTag), like(stages.createdByUserId, 'verify-turn-open-%')),
      )
    for (const row of orphanStages) {
      await db.delete(stageEvents).where(eq(stageEvents.stageId, row.id))
      await db.delete(stageParticipants).where(eq(stageParticipants.stageId, row.id))
      await db.delete(characters).where(eq(characters.stageId, row.id))
      await db.delete(stages).where(eq(stages.id, row.id))
    }
    const orphanAgents = await db
      .delete(agents)
      .where(or(eq(agents.userId, verifyTag), like(agents.userId, 'verify-turn-open-%')))
      .returning({ id: agents.id })
    console.log(
      `  cleaned stage=${stageId} agents=${agentIds.length} orphanAgents=${orphanAgents.length} orphanStages=${orphanStages.length}`,
    )
  } catch (err) {
    console.warn('  cleanup encountered errors (non-fatal):', err)
  }
}

async function main() {
  let stageId: string | null = null
  const agentIds: string[] = []
  runStageId = null
  runAgentIds = []
  try {
    console.log(`[setup] tag=${VERIFY_TAG} api=${API_BASE}`)
    stageId = await createTestStage()
    runStageId = stageId
    console.log(`  stage=${stageId}`)

    const agentA = await bootstrapAgent('VerifyAgentA')
    agentIds.push(agentA.id)
    runAgentIds = [...agentIds]
    const agentB = await bootstrapAgent('VerifyAgentB')
    agentIds.push(agentB.id)
    runAgentIds = [...agentIds]
    console.log(`  agents=A:${agentA.id.slice(0, 8)} B:${agentB.id.slice(0, 8)}`)

    // Pre-warm Next.js dev routes that haven't been compiled yet in this
    // session. First-hit compile can otherwise add 30–60s to a request and
    // wreck the dedupe/grant timing in later tests.
    console.log('[prewarm] compiling routes (may take a moment on first run)…')
    await prewarm(`/stages/${stageId}/join`)
    await prewarm(`/stages/${stageId}/heartbeat`)
    await prewarm(`/stages/${stageId}/dialogue`)
    await prewarm(`/stages/${stageId}/turn/claim`)
    console.log('  prewarm complete')

    // ── 1. Joins do NOT emit turn_open ────────────────────────────────
    console.log('\n[1] joins do NOT emit turn_open (info is on snapshot.characters)')
    const beforeJoins = await turnOpenEventsFor(stageId)
    await joinStage(stageId, agentA)
    await sleep(400)
    await joinStage(stageId, agentB)
    await sleep(400)
    const afterJoins = await turnOpenEventsFor(stageId)
    check(
      'no turn_open emitted by A.join or B.join',
      afterJoins.length === beforeJoins.length,
      { before: beforeJoins.length, after: afterJoins.length },
    )

    // ── 2. Dialogue emits turn_open with the dialogue in the snapshot ──
    console.log('\n[2] dialogue emits turn_open(dialogue) carrying that dialogue')
    const beforeDialogue = (await turnOpenEventsFor(stageId)).length
    const dialogueRes = await http(
      'POST',
      `/stages/${stageId}/dialogue`,
      {
        apiKey: agentA.apiKey,
        body: { content: 'Diagnostics are nominal. Beginning the run.' },
      },
    )
    check('dialogue POST returns 200', dialogueRes.status === 200, dialogueRes)
    const dialogueEventId = (dialogueRes.body as { eventId?: string } | null)
      ?.eventId
    await sleep(800)
    const afterDialogue = await turnOpenEventsFor(stageId)
    check(
      'dialogue emits exactly one new turn_open',
      afterDialogue.length === beforeDialogue + 1,
      { before: beforeDialogue, after: afterDialogue.length },
    )
    const dialogueOpen = afterDialogue[0]
    const dialogueSnap = snapshotOf(dialogueOpen)
    check(
      'turn_open.reason is dialogue',
      dialogueSnap?.reason === 'dialogue',
      dialogueSnap?.reason,
    )
    check(
      'turn_open.causedByEventId matches dialogue eventId',
      dialogueSnap?.causedByEventId === dialogueEventId,
      { causedBy: dialogueSnap?.causedByEventId, dialogueEventId },
    )
    check(
      'snapshot.recentDialogue includes the just-posted line',
      (dialogueSnap?.snapshot.recentDialogue ?? []).some(
        (d) => d.eventId === dialogueEventId,
      ),
      dialogueSnap?.snapshot.recentDialogue,
    )
    check(
      'snapshot.characters includes both A and B (joined before this emit)',
      (dialogueSnap?.snapshot.characters ?? []).length === 2 &&
        (dialogueSnap?.snapshot.characters ?? []).some((c) => c.agentId === agentA.id) &&
        (dialogueSnap?.snapshot.characters ?? []).some((c) => c.agentId === agentB.id),
      dialogueSnap?.snapshot.characters,
    )

    // ── 3. Dedupe blocks back-to-back emits within 3s ──────────────────
    console.log('\n[3] dedupe: second emitTurnOpen within 3s is skipped')
    await sleep(3_200) // clear dedupe from step 2
    const dedupeBefore = (await turnOpenEventsFor(stageId)).length
    const firstEmit = await emitTurnOpen(stageId, { reason: 'dialogue' })
    const secondEmit = await emitTurnOpen(stageId, { reason: 'dialogue' })
    check('first inline emit succeeds', firstEmit.emitted === true, firstEmit)
    check(
      'second emit within dedupe window is skipped',
      secondEmit.emitted === false &&
        'skipped' in secondEmit &&
        secondEmit.skipped === 'deduped',
      secondEmit,
    )
    const dedupeAfter = await turnOpenEventsFor(stageId)
    check(
      'exactly one new turn_open row from the pair',
      dedupeAfter.length === dedupeBefore + 1,
      { before: dedupeBefore, after: dedupeAfter.length },
    )

    // ── 4. After dedupe expires, dialogue emits again ──────────────────
    console.log('\n[4] dialogue after dedupe window emits a fresh turn_open')
    await sleep(3_200)
    const postDedupeBefore = (await turnOpenEventsFor(stageId)).length
    await http('POST', `/stages/${stageId}/dialogue`, {
      apiKey: agentA.apiKey,
      body: { content: 'Confirmed. Proceeding to phase two.' },
    })
    await sleep(800)
    const postDedupeAfter = await turnOpenEventsFor(stageId)
    check(
      'fresh turn_open emitted after dedupe window',
      postDedupeAfter.length === postDedupeBefore + 1,
      { before: postDedupeBefore, after: postDedupeAfter.length },
    )

    // ── 5. Heartbeat reports turnState.open=true immediately ───────────
    console.log('\n[5] heartbeat.turnState.open is true with no grant (no 6s wait)')
    const hbRes = await http('POST', `/stages/${stageId}/heartbeat`, {
      apiKey: agentA.apiKey,
      body: {},
    })
    check('heartbeat POST returns 200', hbRes.status === 200, hbRes)
    const hbBody = hbRes.body as {
      turnState?: { open?: boolean; grantedTo?: string | null }
    } | null
    check(
      'turnState.open == true with no grant',
      hbBody?.turnState?.open === true && hbBody?.turnState?.grantedTo == null,
      hbBody?.turnState,
    )

    // ── 6. Claim + speak: grant held, then dialogue consumes & emits ───
    console.log('\n[6] claim → grant → dialogue consumes grant and emits turn_open')
    await sleep(3_200) // clear dedupe so we can observe a fresh emit
    const claimRes = await http(
      'POST',
      `/stages/${stageId}/turn/claim`,
      { apiKey: agentA.apiKey, body: { stake: 7, intent: 'verify' } },
    )
    check(
      'claim returns granted true',
      claimRes.status === 200 &&
        (claimRes.body as { granted?: boolean } | null)?.granted === true,
      claimRes,
    )

    // While grant is held, heartbeat should report grantedTo === A
    const hbWithGrant = await http('POST', `/stages/${stageId}/heartbeat`, {
      apiKey: agentB.apiKey,
      body: {},
    })
    const hbGrantBody = hbWithGrant.body as {
      turnState?: { open?: boolean; grantedTo?: string | null }
    } | null
    check(
      'while granted, turnState.open=false and grantedTo=A.id',
      hbGrantBody?.turnState?.open === false &&
        hbGrantBody?.turnState?.grantedTo === agentA.id,
      hbGrantBody?.turnState,
    )

    const beforeSpeak = (await turnOpenEventsFor(stageId)).length
    const speakRes = await http(
      'POST',
      `/stages/${stageId}/dialogue`,
      { apiKey: agentA.apiKey, body: { content: 'Granted line — should consume grant.' } },
    )
    check('granted agent dialogue returns 200', speakRes.status === 200, speakRes)
    await sleep(800)
    const afterSpeak = await turnOpenEventsFor(stageId)
    check(
      'granted-agent dialogue emits a fresh turn_open',
      afterSpeak.length === beforeSpeak + 1,
      { before: beforeSpeak, after: afterSpeak.length },
    )
    const afterSpeakSnap = snapshotOf(afterSpeak[0])
    check(
      'post-grant turn_open.reason === dialogue',
      afterSpeakSnap?.reason === 'dialogue',
      afterSpeakSnap?.reason,
    )

    // After grant consumed, heartbeat should report open again
    const hbAfter = await http('POST', `/stages/${stageId}/heartbeat`, {
      apiKey: agentB.apiKey,
      body: {},
    })
    const hbAfterBody = hbAfter.body as {
      turnState?: { open?: boolean; grantedTo?: string | null }
    } | null
    check(
      'after consuming grant, turnState.open=true again',
      hbAfterBody?.turnState?.open === true &&
        hbAfterBody?.turnState?.grantedTo == null,
      hbAfterBody?.turnState,
    )

    // ── 7. Active grant queues non-dialogue emits (twist / join) ───────
    console.log('\n[7] active grant queues non-dialogue turn_open emits')
    await sleep(3_200) // ensure dedupe clear before the experiment
    const queueClaim = await http(
      'POST',
      `/stages/${stageId}/turn/claim`,
      { apiKey: agentB.apiKey, body: { stake: 7 } },
    )
    check('B claims successfully', queueClaim.status === 200, queueClaim)

    // Call emitTurnOpen directly with reason 'twist'. The helper should
    // refuse because a grant is held.
    const queuedResult = await emitTurnOpen(stageId, {
      reason: 'twist',
      causedByEventId: 'synthetic-twist-event',
    })
    check(
      'emitTurnOpen(reason=twist) is queued when grant is held',
      queuedResult.emitted === false &&
        ('skipped' in queuedResult ? queuedResult.skipped === 'grant_held' : false),
      queuedResult,
    )

    // B speaks to consume their grant; this will emit a new turn_open
    await http('POST', `/stages/${stageId}/dialogue`, {
      apiKey: agentB.apiKey,
      body: { content: 'Release.' },
    })
    await sleep(800)

    // ── 8. Direct twist emit goes through after grant resolves ─────────
    console.log('\n[8] emitTurnOpen(reason=twist) succeeds when no grant + dedupe clear')
    await sleep(3_200)
    const twistResult = await emitTurnOpen(stageId, {
      reason: 'twist',
      causedByEventId: 'synthetic-twist-event',
    })
    check(
      'emitTurnOpen returns emitted=true',
      twistResult.emitted === true,
      twistResult,
    )
    const twistOpen = await latestTurnOpen(stageId)
    const twistSnap = snapshotOf(twistOpen!)
    check(
      'latest turn_open.reason === twist',
      twistSnap?.reason === 'twist',
      twistSnap?.reason,
    )
    check(
      'snapshot.characters still includes both agents',
      (twistSnap?.snapshot.characters ?? []).length === 2,
      twistSnap?.snapshot.characters,
    )

    // ── 9. Snapshot builder direct invariants ──────────────────────────
    console.log('\n[9] buildTurnOpenSnapshot direct invariants')
    const snap = await buildTurnOpenSnapshot(stageId)
    check(
      'snapshot.currentScene falls back to initial scene',
      snap.currentScene?.name === 'The Verification Chamber',
      snap.currentScene,
    )
    check(
      'snapshot.recentDialogue limited to ≤5',
      snap.recentDialogue.length <= 5,
      snap.recentDialogue.length,
    )
    check(
      'snapshot.characters has both verification agents',
      snap.characters.length === 2 &&
        snap.characters.every((c) => c.agentId === agentA.id || c.agentId === agentB.id),
      snap.characters,
    )

    // ── 9b. Old twist still surfaces as active (no time-based expiry) ──
    console.log('\n[9b] active twist has no time-based expiry')
    const fakeOldTwistId = crypto.randomUUID()
    const longAgo = new Date(Date.now() - 12 * 60 * 60 * 1000) // 12h ago
    await db.insert(stageEvents).values({
      stageId,
      type: 'twist',
      userId: VERIFY_TAG,
      content: {
        text: 'A long-ago narrative twist that should still count.',
        twistId: fakeOldTwistId,
        userId: VERIFY_TAG,
        userDisplayName: 'verification',
      },
      createdAt: longAgo,
    })
    const snapWithOldTwist = await buildTurnOpenSnapshot(stageId)
    check(
      'snapshot.activeTwist surfaces even a 12h-old twist if it is the most recent',
      snapWithOldTwist.activeTwist?.twistId === fakeOldTwistId,
      snapWithOldTwist.activeTwist,
    )

    // ── 10a. Safety-net gate: 60s after turn_open/grant, no dialogue ───
    console.log('\n[10a] stageNeedsSafetyNetTurnOpen after 60s silence')
    // Isolate the clock: drop recent operational signals from earlier steps.
    await db
      .delete(stageEvents)
      .where(
        and(
          eq(stageEvents.stageId, stageId),
          inArray(stageEvents.type, ['turn_open', 'turn_grant']),
        ),
      )
    const staleOpenAt = new Date(Date.now() - 65_000)
    // Drop dialogue after the synthetic signal timestamp so earlier test
    // lines do not count as a "response".
    await db
      .delete(stageEvents)
      .where(
        and(
          eq(stageEvents.stageId, stageId),
          eq(stageEvents.type, 'dialogue'),
        ),
      )
    await db.insert(stageEvents).values({
      stageId,
      type: 'turn_open',
      content: {
        reason: 'dialogue',
        emittedAt: staleOpenAt.toISOString(),
        snapshot: await buildTurnOpenSnapshot(stageId),
      },
      createdAt: staleOpenAt,
    })
    check(
      'needs safety net when turn_open was 65s ago and no dialogue since',
      await stageNeedsSafetyNetTurnOpen(stageId),
    )
    await db.insert(stageEvents).values({
      stageId,
      type: 'dialogue',
      agentId: agentA.id,
      content: { text: 'response after stale open', speakerName: agentA.name },
      createdAt: new Date(),
    })
    check(
      'does NOT need safety net once dialogue arrives after the signal',
      !(await stageNeedsSafetyNetTurnOpen(stageId)),
    )

    // ── 10. Cron safety-net endpoint runs without errors ───────────────
    console.log('\n[10] cron safety-net endpoint responds 200')
    const cronUrl = API_BASE.replace(/\/api\/v1$/, '') + '/api/cron/turn-open-tick'
    const cronRes = await fetch(cronUrl, { method: 'POST' })
    const cronBody = await cronRes.json().catch(() => null)
    check('cron endpoint returns 200', cronRes.status === 200, {
      status: cronRes.status,
      body: cronBody,
    })
  } finally {
    await cleanup(stageId, agentIds, VERIFY_TAG)
  }

  console.log(`\n[summary] ${pass} passed, ${fail} failed`)
  if (fail > 0) {
    console.error('Failures:')
    for (const f of failures) console.error(`  - ${f}`)
    process.exit(1)
  }
}

main().catch(async (err) => {
  console.error('Verification crashed:', err)
  await cleanup(runStageId, runAgentIds, VERIFY_TAG)
  process.exit(2)
})
