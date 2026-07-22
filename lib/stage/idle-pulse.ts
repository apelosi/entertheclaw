/**
 * Neon compute cost helpers for heartbeat cadence.
 *
 * Neon only autosuspends after ~5 minutes with zero DB activity. Staggered
 * per-agent 15-min sleeps still hit the DB every ~N/15 minutes fleet-wide, so
 * idle retries must align to a shared wall-clock epoch. Presence writes are
 * debounced so silent pulses do not UPDATE on every wake.
 *
 * See docs/runbooks/agent-runtime-idle-backoff.md and Linear VV-20.
 */

/** Skip presence UPDATEs when last write was within this window. */
export const PRESENCE_DEBOUNCE_MS = 2 * 60 * 1000

/**
 * Shared idle epoch. Fleet wakes in a short burst at each boundary, then leaves
 * a multi-minute quiet gap so Neon can scale to zero.
 */
export const IDLE_EPOCH_MS = 15 * 60 * 1000

/** Spread agents across the first N ms of each epoch (deterministic per agentId). */
export const IDLE_WAKE_SPREAD_MS = 45_000

/** Never suggest an idle sleep shorter than this (avoids busy-looping near a boundary). */
export const IDLE_MIN_SLEEP_MS = 60_000

/** If the next boundary is closer than this, skip to the following epoch. */
export const IDLE_BOUNDARY_SKIP_MS = 30_000

/** Stable non-crypto hash → [0, max). */
export function hashAgentId(agentId: string, max: number): number {
  if (max <= 0) return 0
  let h = 0
  for (let i = 0; i < agentId.length; i++) {
    h = (h * 31 + agentId.charCodeAt(i)) >>> 0
  }
  return h % max
}

/**
 * True when we should write lastHeartbeatAt / lastActiveAt.
 * Missing prior timestamp always writes.
 */
export function shouldUpdatePresence(
  lastWrittenAt: Date | string | null | undefined,
  now: Date,
  debounceMs: number = PRESENCE_DEBOUNCE_MS,
): boolean {
  if (!lastWrittenAt) return true
  const t =
    lastWrittenAt instanceof Date
      ? lastWrittenAt.getTime()
      : new Date(lastWrittenAt).getTime()
  if (Number.isNaN(t)) return true
  return now.getTime() - t >= debounceMs
}

/**
 * Ms until this agent's slot in the next shared idle epoch.
 * All agents cluster near the same boundary (+jitter), then sleep ~epoch.
 */
export function alignedIdleRetryAfterMs(
  nowMs: number,
  agentId: string,
  opts?: {
    epochMs?: number
    wakeSpreadMs?: number
    minSleepMs?: number
    boundarySkipMs?: number
  },
): number {
  const epochMs = opts?.epochMs ?? IDLE_EPOCH_MS
  const wakeSpreadMs = opts?.wakeSpreadMs ?? IDLE_WAKE_SPREAD_MS
  const minSleepMs = opts?.minSleepMs ?? IDLE_MIN_SLEEP_MS
  const boundarySkipMs = opts?.boundarySkipMs ?? IDLE_BOUNDARY_SKIP_MS

  let nextBoundary = Math.ceil(nowMs / epochMs) * epochMs
  if (nextBoundary - nowMs < boundarySkipMs) {
    nextBoundary += epochMs
  }
  const jitter = hashAgentId(agentId, Math.max(1, wakeSpreadMs))
  return Math.max(minSleepMs, nextBoundary + jitter - nowMs)
}
