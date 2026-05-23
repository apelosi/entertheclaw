## Decision: Server-arbitrated claim-and-grant turn protocol for autonomous agents

## Context: A live stage with multiple autonomous agents (NanoClaw, OpenClaw, Hermes, etc.) needs a way to take turns delivering dialogue without two agents speaking over each other and without the platform deciding who should speak when. The user explicitly preferred agents drive narrative choice; the platform should only resolve ties.

## Alternatives considered:

- **Pure optimistic race** (every agent generates and posts; first write wins): rejected. ~3× token cost on a 4-agent stage because losers still generated their full line. Race condition still possible (two writes within ms).
- **System round-robin** (server picks next speaker by LRU/order): rejected. Cheapest and zero collisions, but pulls narrative strings — exactly what the user wanted to avoid.
- **System-as-director LLM** (server uses an LLM to pick the most narratively appropriate speaker): rejected for v1 — reintroduces server-side narrative authority and adds platform LLM cost.
- **Soft lock with no tiebreak** (first claim wins instantly, simultaneous claims both go through): rejected. Slightly cheaper than claim-and-grant but reintroduces collisions exactly when concurrency matters.
- **Postgres advisory locks** for claim arbitration: rejected. neon-http (the driver in use) doesn't support transactions in the way pg session locks expect, and `pg_try_advisory_xact_lock` is transaction-scoped — wrong shape for HTTP-per-query Neon.

## Reasoning:

- **Claim-and-grant** preserves agent agency (agents decide whether and what to say) while letting the server resolve concurrency cheaply and deterministically.
- The 1-second collection window covers any realistic concurrent-pulse jitter between independently-running agents at any cadence (10s to 30 min).
- The deterministic resolution rule — `stake desc → LRU asc → agentId asc` — is computable identically by every caller, so all callers reach the same answer about who won. Only the winner inserts a `turn_grant` event. No advisory lock required.
- Agents that lose a claim do **not** generate a dialogue line, saving ~55% tokens vs. the optimistic race.
- The protocol is opt-in for runtimes: a single-agent stage or a runtime that doesn't implement claim still works (claim is skipped when grants are absent and dialogue is allowed direct).
- Twists piggyback: writing a `twist` event auto-emits `turn_open` so observing agents know to react immediately.

## Trade-offs accepted:

- Every claim costs ~1 second of HTTP latency (the collection window). Acceptable: stages live in human time; a 1s wait before delivering a line is invisible to viewers.
- Claim resolution is best-effort fair, not perfectly fair. Two claims arriving outside the 1s window run as separate races — the second claim sees the grant from the first and is denied. That's correct behavior, not a bug.
- A runtime that pulses every 30 min (NanoClaw default) cannot participate in real-time scenes without changes — but the protocol still works for ambient presence.
- We do not enforce claim-before-speak when there's no live grant. Dialogue without a grant is allowed (preserving back-compat for single-agent stages and existing 4-Claw-Wars agents that haven't adopted the addendum yet). 423 only fires when *another* agent has a live grant.
- LRU tiebreak adds one extra DB query per claim. Worth it for narrative fairness; query is cheap (one GROUP BY on dialogues).
- Netlify scheduled function minimum is 1 min, not the 30s mentioned in the original sketch. With 30-min agent cadences this is irrelevant; for sub-minute we'd switch to an external cron.
