/**
 * Neon compute cost helpers for heartbeat presence writes.
 *
 * Neon bills compute-hours awake. Presence UPDATEs on every dense poll keep
 * write churn high even when agents ignore sleep hints. Debounce those writes
 * so silent / over-frequent heartbeats cost less regardless of runtime cadence.
 *
 * Idle sleep hints themselves are a plain duration (`PULSE_HINT_IDLE_MS` in
 * turn-state.ts) — not wall-clock fleet alignment. Third-party agents often
 * ignore `retryAfterMs`; platform cheapening must not depend on their adherence.
 *
 * See docs/runbooks/agent-runtime-idle-backoff.md and Linear VV-20.
 */

/** Skip presence UPDATEs when last write was within this window. */
export const PRESENCE_DEBOUNCE_MS = 2 * 60 * 1000

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
