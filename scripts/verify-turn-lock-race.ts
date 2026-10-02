/**
 * Verify the stage turn lock against a real database (dev branch only).
 *
 *   bun scripts/verify-turn-lock-race.ts
 *
 * 1. N concurrent acquireTurnLock calls on one stage → exactly one wins.
 * 2. While held → a further claim loses.
 * 3. Holder speaks (dialogue after grant) → floor reopens.
 * 4. Hold expires → floor reopens.
 * Cleans up its lock row and the dialogue event it inserts.
 */
import { db } from '@/lib/db/client'
import { agents, stageEvents, stageTurnLocks, stages } from '@/lib/db/schema'
import { acquireTurnLock } from '@/lib/stage/turn-lock'
import { eq, sql } from 'drizzle-orm'
import crypto from 'crypto'

const CONCURRENT = 20

function check(label: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) process.exitCode = 1
}

async function main(): Promise<void> {
  const [stage] = await db.select({ id: stages.id }).from(stages).limit(1)
  const agentRows = await db.select({ id: agents.id }).from(agents).limit(CONCURRENT)
  if (!stage || agentRows.length < 2) throw new Error('need 1 stage and 2+ agents in this DB')
  const stageId = stage.id
  let insertedDialogueId: string | null = null

  try {
    await db.delete(stageTurnLocks).where(eq(stageTurnLocks.stageId, stageId))

    // 1. concurrent race
    const results = await Promise.all(
      Array.from({ length: CONCURRENT }, (_, i) =>
        acquireTurnLock({
          stageId,
          agentId: agentRows[i % agentRows.length].id,
          claimId: crypto.randomUUID(),
        }),
      ),
    )
    const winners = results.filter(Boolean).length
    check(`${CONCURRENT} concurrent claims → exactly 1 granted`, winners === 1, `${winners} granted`)

    const [held] = await db.select().from(stageTurnLocks).where(eq(stageTurnLocks.stageId, stageId))
    const other = agentRows.find((a) => a.id !== held.agentId)!

    // 2. held → loses
    const second = await acquireTurnLock({ stageId, agentId: other.id, claimId: crypto.randomUUID() })
    check('claim while floor is held → refused', second === null)

    // 3. holder speaks → reopens
    const [dialogue] = await db
      .insert(stageEvents)
      .values({ stageId, type: 'dialogue', agentId: held.agentId, content: { text: '[turn-lock verify]' } })
      .returning({ id: stageEvents.id })
    insertedDialogueId = dialogue.id
    const afterSpeak = await acquireTurnLock({ stageId, agentId: other.id, claimId: crypto.randomUUID() })
    check('holder spoke → next claim granted', afterSpeak !== null)

    // 4. expiry → reopens
    await db
      .update(stageTurnLocks)
      .set({ expiresAt: sql`now() - interval '1 second'` })
      .where(eq(stageTurnLocks.stageId, stageId))
    const afterExpiry = await acquireTurnLock({ stageId, agentId: held.agentId, claimId: crypto.randomUUID() })
    check('hold expired → next claim granted', afterExpiry !== null)
  } finally {
    await db.delete(stageTurnLocks).where(eq(stageTurnLocks.stageId, stageId))
    if (insertedDialogueId) await db.delete(stageEvents).where(eq(stageEvents.id, insertedDialogueId))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
