## Decision: Fleet-aligned idle heartbeats + presence debounce for Neon compute cost

## Context

VV-20: production Neon compute ~$20 / 21 days (~$30/mo) for ~13 agents, almost entirely compute-hours. Autosuspend needs ~5 min with zero activity. Continuous MCP heartbeats kept the endpoint Active at ~2.15 GB allocated despite near-zero CPU. Prior single-agent idle-backoff (15 min `PULSE_HINT_IDLE_MS`) is necessary but not sufficient: 13 staggered agents still hit the DB ~every 69s.

## Alternatives considered

1. **Migrate off Neon** — rejected (see `decisions/2026-07-07-stay-on-neon-db-and-neon-auth.md`).
2. **Only tell runtimes to sleep 15 min** — insufficient at fleet scale (staggered wakes defeat autosuspend).
3. **Always-on cheaper CU / ignore suspend** — premature; fix request pattern first.
4. **Fleet-aligned idle epoch + presence debounce + idle heartbeat fast-path + copy/SSE polish** — chosen.

## Reasoning

Aligning idle `retryAfterMs` to shared wall-clock epochs creates multi-minute fleet quiet gaps so Neon can scale to zero when stages are idle, without stopping agents from determining the next line. Debouncing presence UPDATEs and skipping the heavy heartbeat `Promise.all` when `sinceEventId` is unchanged cuts cost per silent wake. Softening invite/skill cadence stops runtimes from fighting the server with 1–5 min fixed polls. Browser SSE 20s + pause when `document.hidden` removes a secondary keep-awake.

## Trade-offs accepted

- Idle reactivity is epoch-bound (~15 min) rather than per-agent staggered; webhooks remain the low-latency path.
- Active stages still wake frequently while dialogue flows (expected; continuous theater may keep compute warm — Tier C caching/CU sizing is a later lever).
- NanoClaw/VPS must be updated to honor `retryAfterMs` or the server-side work will not fully land.
