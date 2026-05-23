#!/usr/bin/env tsx
/**
 * One-shot bootstrap for stages that have dialogue but never received turn_open
 * (e.g. Claw Wars agents spoke before turn protocol shipped).
 *
 * Usage:
 *   bun run stage:bootstrap-turn-open
 *   bun run stage:bootstrap-turn-open -- --stage-id=<uuid>
 *   bun run stage:bootstrap-turn-open -- --dry-run
 *
 * Requires DATABASE_URL in `.env.local` (same as other db scripts).
 */
import './load-env-local'
import { db } from '../lib/db/client'
import { stages } from '../lib/db/schema'
import { eq } from 'drizzle-orm'
import {
  emitTurnOpen,
  emitTurnOpenSafetyNet,
  stageHasTurnProtocolSignals,
  stageNeedsSafetyNetTurnOpen,
} from '../lib/stage/emit-turn-open'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const stageArg = args.find((a) => a.startsWith('--stage-id='))
const stageIdFilter = stageArg?.split('=')[1]

async function main() {
  if (stageIdFilter) {
    const needs = await stageNeedsSafetyNetTurnOpen(stageIdFilter)
    const hasSignals = await stageHasTurnProtocolSignals(stageIdFilter)
    console.log(`Stage ${stageIdFilter}: hasSignals=${hasSignals} needs=${needs}`)
    if (!needs) {
      console.log('Nothing to bootstrap for this stage.')
      return
    }
    if (dryRun) {
      console.log('[dry-run] would emit turn_open (safety_net)')
      return
    }
    const result = await emitTurnOpen(stageIdFilter, {
      reason: 'safety_net',
      applyDedupe: false,
    })
    console.log(result)
    return
  }

  if (dryRun) {
    const active = await db
      .select({ id: stages.id, name: stages.name })
      .from(stages)
      .where(eq(stages.isActive, true))
    for (const s of active) {
      const hasSignals = await stageHasTurnProtocolSignals(s.id)
      const needs = await stageNeedsSafetyNetTurnOpen(s.id)
      if (needs) {
        console.log(`[dry-run] would emit: ${s.name} (${s.id}) bootstrap=${!hasSignals}`)
      }
    }
    return
  }

  const result = await emitTurnOpenSafetyNet()
  console.log('Safety-net scan:', result)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
