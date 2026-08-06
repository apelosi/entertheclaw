#!/usr/bin/env tsx
/**
 * Print a host `ncl tasks create` command for a NanoClaw ETC group.
 *
 * WHERE to run the printed command: VPS ~/nanoclaw-v2 (not this cloud VM).
 * Plaintext keys are never read from the ETC database — pass --api-key or
 * leave the placeholder and substitute on the VPS from the group env.
 *
 * Examples:
 *   bun scripts/print-nanoclaw-pulse-task.ts --group 9 --stage-id a75aedbf-…
 *   bun scripts/print-nanoclaw-pulse-task.ts --group 9 --stage-id … --api-key "$ETC_API_KEY"
 */

import {
  buildNanoclawPulseTaskSpec,
  inferNanoclawGroupNum,
} from '../lib/agents/nanoclaw-pulse-task'

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return undefined
  return process.argv[idx + 1]
}

function usage(): never {
  console.error(`Usage:
  bun scripts/print-nanoclaw-pulse-task.ts --group <N> --stage-id <uuid> [--api-url URL] [--second 0-59] [--api-key KEY]

ETC09 recovery example:
  bun scripts/print-nanoclaw-pulse-task.ts \\
    --group 9 \\
    --stage-id a75aedbf-ad7b-41da-bec4-3e3954d3b618
`)
  process.exit(1)
}

const groupRaw = arg('--group')
const stageId = arg('--stage-id')
const apiUrl = arg('--api-url')
const secondRaw = arg('--second')
const apiKey = arg('--api-key')
const nameHint = arg('--name')

if (!stageId) usage()

let groupNum = groupRaw ? Number(groupRaw) : null
if (groupNum == null && nameHint) groupNum = inferNanoclawGroupNum(nameHint)
if (groupNum == null || !Number.isInteger(groupNum)) usage()

const spec = buildNanoclawPulseTaskSpec({
  groupNum,
  stageId,
  apiUrl,
  recurrenceSecond: secondRaw != null ? Number(secondRaw) : undefined,
  apiKeyPlaceholder: apiKey || '<ETC_API_KEY>',
})

console.log(`# NanoClaw pulse task — WHERE: VPS ~/nanoclaw-v2
# group=${spec.groupId}  folder=${spec.groupFolder} (alt ${spec.groupFolderAlt})
# name=${spec.taskName}  recurrence=${spec.recurrence}
# Gate always ends wakeAgent:false; uses OPENROUTER_API_KEY inside etc-pulse-run.sh.
#
# 1) Confirm group folder exists and has OPENROUTER_API_KEY configured in onecli.
# 2) MUST substitute a real etc_live_… key for <ETC_API_KEY> before create.
#    Literal <ETC_API_KEY> will schedule a task that fails auth forever.
#    Prod DB cannot recover plaintext — read from ${spec.groupFolder}/container.json.
# 3) Run the create command below, then verify with:
#      ./bin/ncl tasks list | grep -E '${spec.groupId}|etc-pulse'
#      ./bin/ncl tasks get <task-id>
# 4) Within ~1–2 minutes, agent last_heartbeat_at should advance on the stage.

${spec.hostCreateCommand}
`)
