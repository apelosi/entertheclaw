/**
 * Presence-write debounce for heartbeats.
 *
 * Neon bills CU-hours awake × size. Presence UPDATEs on every dense poll add
 * write churn (and neon-http session overhead) even when stages stay live.
 * Debounce those writes; do not treat this as a scale-to-zero lever.
 *
 * See decisions/2026-08-16-neon-always-on-floor.md and Linear VV-20.
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
