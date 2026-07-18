/**
 * API-level verify for pair/cast-share backoff (409 pair_backoff).
 *
 * Creates a scratch stage + 3 agents, seeds A↔B dialogue in the DB (avoids the
 * 60s speak rate limit), then hits claim/heartbeat against a running server.
 *
 * Usage:
 *   VERIFY_ALLOW_DB_WRITES=1 bun scripts/verify-pair-backoff-api.ts
 *
 * Requires:
 *   - VERIFY_ALLOW_DB_WRITES=1
 *   - dev server on http://localhost:3000 (VERIFY_API_URL to override)
 *   - DATABASE_URL pointing at the same DB the server uses (dev or staging)
 *
 * Cleans up in finally. Orphans: `bun run db:cleanup-verify-agents`
 */
import './verify-turn-open-guard'
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
import { eq, inArray, like, or } from 'drizzle-orm'
import {
  generateApiKey,
  hashApiKey,
  getApiKeyPrefix,
} from '../lib/api/agent-auth'

const API_BASE = process.env.VERIFY_API_URL ?? 'http://localhost:3000/api/v1'
const VERIFY_TAG = `verify-pair-backoff-${Date.now()}`

let runStageId: string | null = null
let runAgentIds: string[] = []

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
  characterId: string
}

async function bootstrapAgent(name: string): Promise<Omit<BootstrappedAgent, 'characterId'>> {
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
  runAgentIds.push(row.id)
  return { id: row.id, apiKey: rawKey, name }
}

async function createTestStage(): Promise<string> {
  const [row] = await db
    .insert(stages)
    .values({
      name: `[verify-pair-backoff] ${VERIFY_TAG}`,
      theme: 'scifi',
      description: 'Scratch stage for pair_backoff verification.',
      initialSceneName: 'The Pair Chamber',
      initialSceneDescription: 'A test space with three operatives.',
      isActive: true,
      createdByUserId: VERIFY_TAG,
    })
    .returning({ id: stages.id })
  runStageId = row.id
  return row.id
}

async function joinAgent(
  stageId: string,
  agent: Omit<BootstrappedAgent, 'characterId'>,
): Promise<BootstrappedAgent> {
  const now = new Date()
  const [character] = await db
    .insert(characters)
    .values({
      agentId: agent.id,
      stageId,
      name: agent.name,
      isComplete: true,
    })
    .returning({ id: characters.id })
  await db.insert(stageParticipants).values({
    stageId,
    agentId: agent.id,
    characterId: character.id,
    role: 'main',
    joinedAt: now,
    lastActiveAt: now,
  })
  return { ...agent, characterId: character.id }
}

/**
 * Seed alternating A/B dialogue rows (newest last in insert order).
 * Last line is ~3.5 minutes ago so trailing-speaker solo_backoff (2m) has
 * elapsed, but pair_backoff quiet (8m at count 6) still applies.
 */
async function seedPairDialogue(
  stageId: string,
  a: BootstrappedAgent,
  b: BootstrappedAgent,
  count: number,
): Promise<void> {
  const spacingMs = 90_000
  const lastAgoMs = 3.5 * 60_000
  const newestAt = Date.now() - lastAgoMs
  const base = newestAt - (count - 1) * spacingMs
  for (let i = 0; i < count; i++) {
    const speaker = i % 2 === 0 ? a : b
    const createdAt = new Date(base + i * spacingMs)
    await db.insert(stageEvents).values({
      stageId,
      type: 'dialogue',
      agentId: speaker.id,
      characterId: speaker.characterId,
      content: {
        text: `[pair-seed ${i}] "Line from ${speaker.name}."`,
        speakerName: speaker.name,
      },
      createdAt,
    })
  }
}

async function http(
  method: string,
  path: string,
  apiKey: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'entertheclaw-verify-pair-backoff/0.1',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, json }
}

async function cleanup(): Promise<void> {
  const stageIds: string[] = []
  if (runStageId) stageIds.push(runStageId)
  const taggedStages = await db
    .select({ id: stages.id })
    .from(stages)
    .where(like(stages.name, `%${VERIFY_TAG}%`))
  for (const s of taggedStages) {
    if (!stageIds.includes(s.id)) stageIds.push(s.id)
  }

  if (stageIds.length) {
    await db.delete(stageEvents).where(inArray(stageEvents.stageId, stageIds))
    await db.delete(stageParticipants).where(inArray(stageParticipants.stageId, stageIds))
    await db.delete(characters).where(inArray(characters.stageId, stageIds))
    await db.delete(stages).where(inArray(stages.id, stageIds))
  }

  const agentIds = [...runAgentIds]
  const taggedAgents = await db
    .select({ id: agents.id })
    .from(agents)
    .where(or(eq(agents.userId, VERIFY_TAG), like(agents.name, `%${VERIFY_TAG}%`)))
  for (const a of taggedAgents) {
    if (!agentIds.includes(a.id)) agentIds.push(a.id)
  }
  if (agentIds.length) {
    await db.delete(stageParticipants).where(inArray(stageParticipants.agentId, agentIds))
    await db.delete(characters).where(inArray(characters.agentId, agentIds))
    await db.delete(stageEvents).where(inArray(stageEvents.agentId, agentIds))
    await db.delete(agents).where(inArray(agents.id, agentIds))
  }
  console.log(`cleanup: removed ${stageIds.length} stage(s), ${agentIds.length} agent(s)`)
}

async function main(): Promise<void> {
  console.log(`Target API: ${API_BASE}`)
  console.log(`VERIFY_TAG: ${VERIFY_TAG}`)

  const health = await fetch(`${API_BASE.replace(/\/api\/v1$/, '')}/api/v1/stages`).catch(
    (e: Error) => ({ ok: false, status: 0, error: e.message }),
  )
  if (!('ok' in health) || !health.ok) {
    console.error('Server not reachable. Start: DATABASE_URL=… bun run dev')
    process.exit(2)
  }

  try {
    const stageId = await createTestStage()
    const rawA = await bootstrapAgent(`PairA-${VERIFY_TAG}`)
    const rawB = await bootstrapAgent(`PairB-${VERIFY_TAG}`)
    const rawC = await bootstrapAgent(`PairC-${VERIFY_TAG}`)
    const a = await joinAgent(stageId, rawA)
    const b = await joinAgent(stageId, rawB)
    const c = await joinAgent(stageId, rawC)

    // --- Short duologue (5 lines): pair members still allowed ---
    console.log('\n[1] Short duologue (5 exclusive lines) — pair may still claim')
    await seedPairDialogue(stageId, a, b, 5)
    const shortClaim = await http('POST', `/stages/${stageId}/turn/claim`, a.apiKey, {
      stake: 7,
      intent: 'short-duologue',
    })
    check(
      'A claim after 5-line duologue is not pair_backoff',
      !(shortClaim.status === 409 && shortClaim.json.error === 'pair_backoff'),
      shortClaim,
    )
    // Consume any grant so later claims see open floor
    if (shortClaim.status === 200 && shortClaim.json.granted === true) {
      await http('POST', `/stages/${stageId}/dialogue`, a.apiKey, {
        content: '[cleanup] "Clearing short-duologue grant."',
      })
    }

    // Clear seeded rows + the possible speak, reseed sustained capture
    await db.delete(stageEvents).where(eq(stageEvents.stageId, stageId))

    // --- Sustained A↔B (6 lines) with third cast active ---
    console.log('\n[2] Sustained A↔B (6 lines) — pair blocked, outsider allowed')
    await seedPairDialogue(stageId, a, b, 6)

    const claimA = await http('POST', `/stages/${stageId}/turn/claim`, a.apiKey, {
      stake: 9,
      intent: 'pair-member',
    })
    check(
      'A claim → 409 pair_backoff',
      claimA.status === 409 && claimA.json.error === 'pair_backoff',
      claimA,
    )
    check(
      'A error body has pairExclusiveCount >= 6',
      typeof claimA.json.pairExclusiveCount === 'number' &&
        (claimA.json.pairExclusiveCount as number) >= 6,
      claimA.json,
    )

    const claimB = await http('POST', `/stages/${stageId}/turn/claim`, b.apiKey, {
      stake: 9,
      intent: 'pair-member',
    })
    // B is the trailing speaker; solo is checked before pair. Seed timestamps
    // put lastDialogueAgo past solo's 2m tier so pair_backoff is what we see.
    check(
      'B claim → 409 pair_backoff',
      claimB.status === 409 && claimB.json.error === 'pair_backoff',
      claimB,
    )

    const hbA = await http('POST', `/stages/${stageId}/heartbeat`, a.apiKey, {})
    const directiveA = hbA.json.directive as { act?: boolean; reason?: string } | undefined
    check(
      'A heartbeat act=false reason=pair_backoff',
      hbA.status === 200 &&
        directiveA?.act === false &&
        directiveA?.reason === 'pair_backoff',
      { status: hbA.status, directive: directiveA },
    )

    const claimC = await http('POST', `/stages/${stageId}/turn/claim`, c.apiKey, {
      stake: 5,
      intent: 'starved-outsider',
    })
    check(
      'C claim is not pair_backoff',
      !(claimC.status === 409 && claimC.json.error === 'pair_backoff'),
      claimC,
    )
    check(
      'C claim granted (or already holding)',
      claimC.status === 200 && claimC.json.granted === true,
      claimC,
    )

    if (claimC.status === 200 && claimC.json.granted === true) {
      const speakC = await http('POST', `/stages/${stageId}/dialogue`, c.apiKey, {
        content: '[steps in] "Enough — the rest of the cast is here."',
      })
      check('C can speak after grant', speakC.status === 200 && speakC.json.ok === true, speakC)

      // After third speaker, pair capture broken — A may claim again
      const claimA2 = await http('POST', `/stages/${stageId}/turn/claim`, a.apiKey, {
        stake: 7,
        intent: 'after-third',
      })
      check(
        'A claim after third speaker is not pair_backoff',
        !(claimA2.status === 409 && claimA2.json.error === 'pair_backoff'),
        claimA2,
      )
    }

    // --- Non-regression: solo open floor still works for a fresh agent path ---
    console.log('\n[3] Non-regression — heartbeat + claim on quiet solo trail')
    await db.delete(stageEvents).where(eq(stageEvents.stageId, stageId))
    // One line from C so floor has history but no pair
    await seedPairDialogue(stageId, c, c, 1)
    // Wait: seedPairDialogue with same agent twice creates solo lines.
    // For initiative after quiet we need lastDialogueAgo large — seed with old timestamp.
    await db.delete(stageEvents).where(eq(stageEvents.stageId, stageId))
    await db.insert(stageEvents).values({
      stageId,
      type: 'dialogue',
      agentId: c.id,
      characterId: c.characterId,
      content: { text: '[old] "Earlier."', speakerName: c.name },
      createdAt: new Date(Date.now() - 10 * 60_000),
    })

    const hbC = await http('POST', `/stages/${stageId}/heartbeat`, a.apiKey, {})
    check('heartbeat still 200 after pair tests', hbC.status === 200, {
      status: hbC.status,
      reason: (hbC.json.directive as { reason?: string } | undefined)?.reason,
    })

    const claimQuiet = await http('POST', `/stages/${stageId}/turn/claim`, a.apiKey, {
      stake: 4,
      intent: 'initiative',
    })
    check(
      'normal claim on open floor still grants',
      claimQuiet.status === 200 && claimQuiet.json.granted === true,
      claimQuiet,
    )
  } finally {
    console.log('\n[cleanup]')
    await cleanup()
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail > 0) {
    console.error('Failures:', failures.join('; '))
    process.exit(1)
  }
  console.log('verify-pair-backoff-api: ok')
}

main().catch((err) => {
  console.error(err)
  cleanup()
    .catch(() => {})
    .finally(() => process.exit(1))
})
