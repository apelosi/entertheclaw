/**
 * Pure-function check of the solo-monologue backoff in build-directive.ts.
 * No DB, no network — decideAct's initiative gate is exercised directly via
 * buildDirective() with synthetic DirectiveInputs.
 */
import { buildDirective, type DirectiveInputs } from '@/lib/stage/build-directive'

let failures = 0

function baseInput(overrides: Partial<DirectiveInputs>): DirectiveInputs {
  return {
    myAgentId: 'agent-1',
    stageName: 'Test Stage',
    character: null,
    characterMemory: null,
    currentScene: null,
    activeTwist: null,
    recentDialogue: [],
    turnState: { open: true, grantedTo: null, lastDialogueAgoMs: null },
    addressedToYou: false,
    nudge: null,
    unreadHasTwist: false,
    idleRetryAfterMs: 15 * 60_000,
    consecutiveSoloDialogueCount: 0,
    ...overrides,
  }
}

function check(label: string, input: DirectiveInputs, expectAct: boolean, expectReason?: string) {
  const directive = buildDirective(input)
  const ok = directive.act === expectAct && (expectReason === undefined || directive.reason === expectReason)
  if (ok) {
    console.log(`  ✓ ${label}`)
  } else {
    failures++
    console.log(
      `  ✗ ${label} — got act=${directive.act} reason=${directive.reason}, expected act=${expectAct}${expectReason ? ` reason=${expectReason}` : ''}`,
    )
  }
}

const MIN = 60_000
const HR = 60 * MIN
const DAY = 24 * HR

console.log('[1] below the solo-backoff threshold (count 0-2): normal 120s cadence')
check('count=0, 119999ms quiet -> not yet', baseInput({ turnState: { open: true, grantedTo: null, lastDialogueAgoMs: 119_999 }, consecutiveSoloDialogueCount: 0 }), false)
check('count=0, 120000ms quiet -> initiative', baseInput({ turnState: { open: true, grantedTo: null, lastDialogueAgoMs: 120_000 }, consecutiveSoloDialogueCount: 0 }), true, 'initiative')
check('count=2, 120000ms quiet -> still normal cadence', baseInput({ turnState: { open: true, grantedTo: null, lastDialogueAgoMs: 120_000 }, consecutiveSoloDialogueCount: 2 }), true, 'initiative')

console.log('[2] count=3: needs 30min, not 120s')
check('count=3, 120000ms quiet -> not enough', baseInput({ turnState: { open: true, grantedTo: null, lastDialogueAgoMs: 120_000 }, consecutiveSoloDialogueCount: 3 }), false)
check('count=3, 30min quiet -> initiative', baseInput({ turnState: { open: true, grantedTo: null, lastDialogueAgoMs: 30 * MIN }, consecutiveSoloDialogueCount: 3 }), true, 'initiative')

console.log('[3] count=4: needs 1hr, not 30min')
check('count=4, 30min quiet -> not enough', baseInput({ turnState: { open: true, grantedTo: null, lastDialogueAgoMs: 30 * MIN }, consecutiveSoloDialogueCount: 4 }), false)
check('count=4, 1hr quiet -> initiative', baseInput({ turnState: { open: true, grantedTo: null, lastDialogueAgoMs: 60 * MIN }, consecutiveSoloDialogueCount: 4 }), true, 'initiative')

console.log('[4] count=5: needs 8hr, not 1hr')
check('count=5, 1hr quiet -> not enough', baseInput({ turnState: { open: true, grantedTo: null, lastDialogueAgoMs: 60 * MIN }, consecutiveSoloDialogueCount: 5 }), false)
check('count=5, 8hr quiet -> initiative', baseInput({ turnState: { open: true, grantedTo: null, lastDialogueAgoMs: 8 * HR }, consecutiveSoloDialogueCount: 5 }), true, 'initiative')

console.log('[5] count=6+: plateaus at 24hr, does not escalate further')
check('count=6, 8hr quiet -> not enough', baseInput({ turnState: { open: true, grantedTo: null, lastDialogueAgoMs: 8 * HR }, consecutiveSoloDialogueCount: 6 }), false)
check('count=6, 24hr quiet -> initiative', baseInput({ turnState: { open: true, grantedTo: null, lastDialogueAgoMs: DAY }, consecutiveSoloDialogueCount: 6 }), true, 'initiative')
check('count=100, 24hr-1ms quiet -> still gated at 24hr (no further escalation)', baseInput({ turnState: { open: true, grantedTo: null, lastDialogueAgoMs: DAY - 1 }, consecutiveSoloDialogueCount: 100 }), false)
check('count=100, 24hr quiet -> initiative (plateau, not higher)', baseInput({ turnState: { open: true, grantedTo: null, lastDialogueAgoMs: DAY }, consecutiveSoloDialogueCount: 100 }), true, 'initiative')

console.log('[6] higher-priority gates bypass the backoff entirely, even deep in it')
check('granted bypasses backoff', baseInput({ turnState: { open: true, grantedTo: 'agent-1', lastDialogueAgoMs: 0 }, consecutiveSoloDialogueCount: 100 }), true, 'granted')
check('addressed bypasses backoff', baseInput({ addressedToYou: true, turnState: { open: true, grantedTo: null, lastDialogueAgoMs: 0 }, consecutiveSoloDialogueCount: 100 }), true, 'addressed')
check('twist bypasses backoff', baseInput({ unreadHasTwist: true, turnState: { open: true, grantedTo: null, lastDialogueAgoMs: 0 }, consecutiveSoloDialogueCount: 100 }), true, 'twist')
check('nudge bypasses backoff', baseInput({ nudge: { level: 'agent_idle' }, turnState: { open: true, grantedTo: null, lastDialogueAgoMs: 0 }, consecutiveSoloDialogueCount: 100 }), true, 'nudge:agent_idle')

console.log('[7] closed floor never triggers initiative regardless of count/timing')
check('turn not open -> idle even with huge count+quiet', baseInput({ turnState: { open: false, grantedTo: null, lastDialogueAgoMs: DAY * 10 }, consecutiveSoloDialogueCount: 100 }), false, 'idle')

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
