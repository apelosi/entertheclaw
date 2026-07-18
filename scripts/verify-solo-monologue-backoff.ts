/**
 * Pure-function check of consecutive-solo initiative schedule.
 * Exercises evaluateSoloBackoff + buildDirective initiative alignment.
 */
import { buildDirective, type DirectiveInputs } from '@/lib/stage/build-directive'
import {
  QUIET_INITIATIVE_MS,
  SOLO_QUIET_AT_2_MS,
  SOLO_QUIET_AT_3_MS,
  SOLO_QUIET_AT_4_MS,
  SOLO_QUIET_AT_5_MS,
  SOLO_QUIET_AT_6_PLUS_MS,
  evaluateSoloBackoff,
} from '@/lib/stage/solo-backoff'

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
  const ok =
    directive.act === expectAct &&
    (expectReason === undefined || directive.reason === expectReason)
  if (ok) {
    console.log(`  ✓ ${label}`)
  } else {
    failures++
    console.log(
      `  ✗ ${label} — got act=${directive.act} reason=${directive.reason}, expected act=${expectAct}${expectReason ? ` reason=${expectReason}` : ''}`,
    )
  }
}

function checkEval(
  label: string,
  count: number,
  lastDialogueAgoMs: number | null,
  expectBlocked: boolean,
) {
  const evaluation = evaluateSoloBackoff({
    consecutiveSoloDialogueCount: count,
    lastDialogueAgoMs,
  })
  if (evaluation.blocked === expectBlocked) {
    console.log(`  ✓ ${label}`)
  } else {
    failures++
    console.log(
      `  ✗ ${label} — got blocked=${evaluation.blocked}, expected ${expectBlocked}`,
    )
  }
}

const MIN = 60_000
const HR = 60 * MIN
const DAY = 24 * HR

console.log('[1] claim hard-reject: count=0 never blocked (reactions)')
checkEval('count=0, 0ms quiet -> allow claim', 0, 0, false)

console.log('[2] claim hard-reject schedule')
checkEval('count=1, 119999ms -> blocked', 1, QUIET_INITIATIVE_MS - 1, true)
checkEval('count=1, 120000ms -> allow', 1, QUIET_INITIATIVE_MS, false)
checkEval('count=2, 120000ms -> blocked (needs 8min)', 2, QUIET_INITIATIVE_MS, true)
checkEval('count=2, 8min -> allow', 2, SOLO_QUIET_AT_2_MS, false)
checkEval('count=3, 8min -> blocked (needs 30min)', 3, SOLO_QUIET_AT_2_MS, true)
checkEval('count=3, 30min -> allow', 3, SOLO_QUIET_AT_3_MS, false)
checkEval('count=4, 30min -> blocked', 4, SOLO_QUIET_AT_3_MS, true)
checkEval('count=4, 1hr -> allow', 4, SOLO_QUIET_AT_4_MS, false)
checkEval('count=5, 1hr -> blocked', 5, SOLO_QUIET_AT_4_MS, true)
checkEval('count=5, 8hr -> allow', 5, SOLO_QUIET_AT_5_MS, false)
checkEval('count=6, 8hr -> blocked', 6, SOLO_QUIET_AT_5_MS, true)
checkEval('count=6, 24hr -> allow', 6, SOLO_QUIET_AT_6_PLUS_MS, false)
checkEval('count=100, 24hr-1ms -> blocked', 100, DAY - 1, true)
checkEval('count=100, 24hr -> allow', 100, DAY, false)

console.log('[3] directive initiative stays aligned with claim schedule')
check(
  'count=0, 119999ms quiet -> not yet',
  baseInput({
    turnState: { open: true, grantedTo: null, lastDialogueAgoMs: 119_999 },
    consecutiveSoloDialogueCount: 0,
  }),
  false,
)
check(
  'count=0, 120000ms quiet -> initiative',
  baseInput({
    turnState: { open: true, grantedTo: null, lastDialogueAgoMs: 120_000 },
    consecutiveSoloDialogueCount: 0,
  }),
  true,
  'initiative',
)
check(
  'count=2, 120000ms quiet -> idle (needs 8min)',
  baseInput({
    turnState: { open: true, grantedTo: null, lastDialogueAgoMs: 120_000 },
    consecutiveSoloDialogueCount: 2,
  }),
  false,
)
check(
  'count=2, 8min quiet -> initiative',
  baseInput({
    turnState: { open: true, grantedTo: null, lastDialogueAgoMs: SOLO_QUIET_AT_2_MS },
    consecutiveSoloDialogueCount: 2,
  }),
  true,
  'initiative',
)
check(
  'count=3, 8min quiet -> idle',
  baseInput({
    turnState: { open: true, grantedTo: null, lastDialogueAgoMs: SOLO_QUIET_AT_2_MS },
    consecutiveSoloDialogueCount: 3,
  }),
  false,
)
check(
  'count=3, 30min quiet -> initiative',
  baseInput({
    turnState: { open: true, grantedTo: null, lastDialogueAgoMs: 30 * MIN },
    consecutiveSoloDialogueCount: 3,
  }),
  true,
  'initiative',
)

console.log('[4] higher-priority gates still bypass the initiative quiet check')
check(
  'granted bypasses',
  baseInput({
    turnState: { open: true, grantedTo: 'agent-1', lastDialogueAgoMs: 0 },
    consecutiveSoloDialogueCount: 100,
  }),
  true,
  'granted',
)
check(
  'addressed bypasses',
  baseInput({
    addressedToYou: true,
    turnState: { open: true, grantedTo: null, lastDialogueAgoMs: 0 },
    consecutiveSoloDialogueCount: 100,
  }),
  true,
  'addressed',
)

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
