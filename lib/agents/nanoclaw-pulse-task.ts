/**
 * NanoClaw durable-wake exception: host `ncl` script-gated pulse task.
 * Matches the working fleet gate (etc-pulse-run.sh → wakeAgent:false).
 * Never embeds plaintext API keys — callers substitute at run time.
 */

export const NANOCLAW_PULSE_PROMPT =
  'Enter The Claw pulse — handled entirely by the platform packaged entertheclaw-pulse binary (see https://entertheclaw.com/skill.md). Routine pulses never wake the agent.'

export const NANOCLAW_PULSE_TASK_NAME = 'etc-pulse'

export interface NanoclawPulseTaskInput {
  /** e.g. 9 for ag-etc-9 / groups/etc-09 */
  groupNum: number
  stageId: string
  /** Unversioned API base. Default production. */
  apiUrl?: string
  /**
   * Cron second-of-minute (0–59). Fleet staggers by 5s; pick an unused slot.
   * Default: (groupNum * 5) % 60
   */
  recurrenceSecond?: number
  /** Placeholder shown in printed script; operator substitutes real key on VPS. */
  apiKeyPlaceholder?: string
  /** Short ncl --name (readable id). Default etc-pulse. */
  taskName?: string
}

export interface NanoclawPulseTaskSpec {
  groupId: string
  /** Preferred host folder (zero-padded for 1–9: groups/etc-09). */
  groupFolder: string
  /** Alternate folder some installs use (groups/etc-9). */
  groupFolderAlt: string
  taskName: string
  recurrence: string
  prompt: string
  script: string
  /** Ready-to-run host shell (key still a placeholder unless provided). */
  hostCreateCommand: string
}

export function nanoclawGroupId(groupNum: number): string {
  if (!Number.isInteger(groupNum) || groupNum < 1 || groupNum > 99) {
    throw new Error(`groupNum must be integer 1–99, got ${groupNum}`)
  }
  return `ag-etc-${groupNum}`
}

/** Host folder as used on the VPS for ETC09: groups/etc-09 (zero-padded). */
export function nanoclawGroupFolder(groupNum: number): string {
  if (!Number.isInteger(groupNum) || groupNum < 1 || groupNum > 99) {
    throw new Error(`groupNum must be integer 1–99, got ${groupNum}`)
  }
  return groupNum < 10 ? `groups/etc-0${groupNum}` : `groups/etc-${groupNum}`
}

export function nanoclawGroupFolderAlt(groupNum: number): string {
  return `groups/etc-${groupNum}`
}

export function buildNanoclawPulseScript(input: {
  stageId: string
  apiUrl?: string
  apiKeyPlaceholder?: string
}): string {
  const apiUrl = (input.apiUrl ?? 'https://entertheclaw.com/api').replace(/\/$/, '')
  const key = input.apiKeyPlaceholder ?? '<ETC_API_KEY>'
  const stageId = input.stageId.trim()
  if (!stageId) throw new Error('stageId is required')

  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    `export ETC_API_KEY=${key}`,
    `export ETC_API_URL=${apiUrl}`,
    `export ETC_STAGE_ID=${stageId}`,
    'exec bash /app/src/scripts/etc-pulse-run.sh',
    '',
  ].join('\n')
}

export function buildNanoclawPulseTaskSpec(
  input: NanoclawPulseTaskInput,
): NanoclawPulseTaskSpec {
  const groupId = nanoclawGroupId(input.groupNum)
  const groupFolder = nanoclawGroupFolder(input.groupNum)
  const groupFolderAlt = nanoclawGroupFolderAlt(input.groupNum)
  const taskName = input.taskName?.trim() || NANOCLAW_PULSE_TASK_NAME
  const second =
    input.recurrenceSecond ?? Math.max(0, Math.min(59, (input.groupNum * 5) % 60))
  const recurrence = `${second} * * * * *`
  const script = buildNanoclawPulseScript({
    stageId: input.stageId,
    apiUrl: input.apiUrl,
    apiKeyPlaceholder: input.apiKeyPlaceholder,
  })

  // ncl accepts --script as a string; single-quote carefully for host shell.
  const scriptForShell = script.replace(/'/g, "'\\''")
  const hostCreateCommand = [
    `./bin/ncl tasks create \\`,
    `  --group ${groupId} \\`,
    `  --name '${taskName.replace(/'/g, `'\\''`)}' \\`,
    `  --recurrence '${recurrence}' \\`,
    `  --prompt '${NANOCLAW_PULSE_PROMPT.replace(/'/g, `'\\''`)}' \\`,
    `  --script '${scriptForShell}'`,
  ].join('\n')

  return {
    groupId,
    groupFolder,
    groupFolderAlt,
    taskName,
    recurrence,
    prompt: NANOCLAW_PULSE_PROMPT,
    script,
    hostCreateCommand,
  }
}

/** Infer group number from names like "NanoClaw ETC9" / "ETC09" / "etc-9". */
export function inferNanoclawGroupNum(name: string | null | undefined): number | null {
  if (!name) return null
  const m = name.match(/(?:etc|ETC)[-\s]?0*(\d{1,2})\b/)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isInteger(n) || n < 1 || n > 99) return null
  return n
}
