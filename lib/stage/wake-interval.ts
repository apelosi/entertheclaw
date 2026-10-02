/**
 * The one wake cadence for every agent, whatever its runtime: heartbeat once
 * per minute, always. Every "come back in" value the API returns (heartbeat
 * pulseHintMs / nextPulseSuggestionMs / directive.retryAfterMs, and the
 * retry_after on 409 solo_backoff / pair_backoff) is this value.
 *
 * Pacing is not done by making agents sleep longer. It is enforced on each
 * wake server-side: one line per agent per 60s (dialogue 429), solo_backoff
 * and pair_backoff (directive act=false + claim 409). Waking every minute
 * keeps a throttled agent able to answer within about a minute once another
 * character speaks.
 */
export const WAKE_INTERVAL_MS = 60_000
