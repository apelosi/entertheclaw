## Decision: `turn_open` as the universal push event (drop `turn_revoke`)

## Context: Phase 1 shipped three operational event types (`turn_open`, `turn_grant`, `turn_revoke`) and a thin `turn_open` payload (just `reason` + timing). The next iteration needed a push-channel design. Multi-mode push (live/responsive/none) was on the table; the user explicitly preferred a single mechanism. The question became: what's the least-complex listen-side surface that still gives an agent enough context to decide whether to claim?

## Decision: A turn_open's payload carries a complete, self-contained snapshot of stage state, and is the only "the situation just changed" event push listeners need to observe alongside `turn_grant`. `turn_revoke` is removed entirely; a fresh `turn_open` implicitly supersedes any prior grant.

## Alternatives considered:

- **Dual-mode push (`live` / `responsive` / `none`):** rejected for debuggability. Each mode would need its own emit logic, retry semantics, and per-agent registration. Configuring or diagnosing "why didn't my agent wake up?" branches across modes.
- **Push every event type (dialogue, twist, scene, join, leave, …):** rejected. Token cost on the listen side, and observers don't actually need every event — they need enough context to decide whether to claim. The same information lives in the snapshot.
- **Keep `turn_revoke` for explicit grant-end signalling:** rejected. Every operational `turn_revoke` case (grant consumed, grant expired, force-released) can be expressed as a new `turn_open` with a `reason` field. Keeping a near-no-op event type is debt.
- **Two-phase context fetch (turn_open → claim → fetch context after grant):** rejected. Adds an extra HTTP round-trip on the critical path and forces the granted agent to manage context state in two pieces. Snapshot up-front is simpler.
- **Tiny `turn_open` + dedicated `GET /context` endpoint:** considered. Powerful but moves the "always have context" contract onto the agent, which then has to know when to refetch. Embedding the snapshot keeps the contract one-way.

## Reasoning:

- A single push event type (`turn_open`) plus a single per-decision push event (`turn_grant`) collapses the listen-side mental model to two messages.
- The snapshot is built at emit time by one helper (`build-turn-open-snapshot.ts`), so push, SSE, and heartbeat agents see identical data.
- Removing `turn_revoke` removes a class of "but what if this fires before that?" sequencing questions; the agent rule is simply "latest turn_open wins."
- The `reason` field carries enough operational signal (`dialogue`, `twist`, `safety_net`) for debugging without expanding event surface.
- Drop the 6-second scene-quiet timer for inline `turn_open` emit. Dialogue posts now emit `turn_open` immediately — the claim-collection window inside `POST /turn/claim` handles concurrency.
- Bump grant TTL from 8 s to 60 s so an LLM-driven granted agent can run history fetch + inference + dialogue post inside one grant.

## Trade-offs accepted:

- Snapshot is larger than the prior skinny payload (last 5 dialogue lines + full character list + scene + active twist). Acceptable; this is dev-stage chat data, low bytes.
- Safety-net cron re-pings `turn_open` after 60 s of silence following `turn_open` or `turn_grant`. Cron minimum on Netlify is ~1 min, so the re-ping is not sub-second; 30-min agents still need the future push channel to wake promptly.
- Twists and joins landing during an active grant do **not** emit `turn_open`. Observers learn of them in their next heartbeat / SSE replay rather than via push. Acceptable: twist cooldown is 6 min, joins are rare.
- Dedupe window (3 s) means back-to-back inline emits coalesce. The first wins. Agents see one `turn_open` per dedupe window — never two for the same moment.
- Dropped `turn_revoke` from the DB enum entirely (migration 0007 edited in place; dev DB will retain the enum value harmlessly until reset).
