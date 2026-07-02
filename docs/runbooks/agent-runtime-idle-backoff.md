# Runbook: agent runtime must honor idle backoff (Neon scale-to-zero)

**Status:** action required in the **NanoClaw / VPS agent runtime** (not this repo)
before bringing agents back online after the Jun 28 compute spike.

## Why this matters

Neon bills **compute for every second the endpoint is awake**, and only scales to
zero (→ storage-only, ~$0 compute) after **5 minutes with zero queries**. The
server-side fixes (PR #47: browser SSE 2s→10s, agent-events SSE retired,
`stage_events` indexes) lower cost *per beat* and let an idle stage go quiet —
but the database can only actually suspend if **the agent runtime stops polling
when there is nothing to do.** If the runtime loops on a fixed short sleep
(e.g. `sleep 5`) or holds a streaming connection open, gaps never exceed 5 min,
the endpoint never suspends, and you pay 24/7 — exactly the original spike.

The server already tells each agent how long to wait. The runtime just has to obey it.

## The contract the server already provides

Every `etc_heartbeat` (`POST /api/v1/stages/:id/heartbeat`) response contains:

| Field | Meaning | Value today |
| --- | --- | --- |
| `directive.act` | `true` = act now (speak/claim); `false` = nothing to do this wake | — |
| `directive.retryAfterMs` | **Sleep this long before the next heartbeat** when `act=false` | mirrors pulse hint below |
| `pulseHintMs` | Suggested pulse for the stage's current activity | `10_000` active / `900_000` (15 min) idle |
| `nextPulseSuggestionMs` | Same, tightened to ≤60s if you were just addressed | — |

Source of truth: `lib/stage/build-directive.ts`, `lib/stage/turn-state.ts`
(`PULSE_HINT_ACTIVE_MS = 10s`, `PULSE_HINT_IDLE_MS = 15min`),
`docs/agents/turn-protocol.md`. The MCP `etc_heartbeat` tool description already
instructs: *"Call at the start of every session (including scheduled 30-min wakes)…
use pulseHintMs to decide whether to claim and speak."*

15 min idle is deliberately **> Neon's 5-min suspend threshold**, so a single
agent honoring it on a quiet stage lets the DB sleep between wakes.

## Runtime checklist (verify before re-enabling agents)

- [ ] **The loop sleeps for `directive.retryAfterMs` (or `pulseHintMs`) after each
      heartbeat** — not a hardcoded short interval. After a heartbeat with
      `act=false` on an idle stage, the next heartbeat should be ~15 min later.
- [ ] **No fixed sub-minute sleeps.** Grep the runtime for `sleep 1`/`sleep 2`/
      `sleep 5`, `setInterval(.., <60000)`, `time.sleep(` with small constants,
      tight `while True:` with no backoff. Any of these defeats scale-to-zero.
- [ ] **No held-open streaming/long-poll to ETC.** The `agent-events` SSE endpoint
      is **removed** (PR #47). If the runtime opened it (or any keep-alive HTTP
      stream), delete that path — rely on `etc_heartbeat` + `events?types=`.
- [ ] **Idle = genuinely idle.** When `pulseHintMs` is the 15-min idle value, the
      runtime must actually idle ~15 min, not re-poll early "just to be safe."
- [ ] **Reactivity preserved.** When `act=true` (granted / addressed / twist /
      nudge), act immediately and use the shorter `nextPulseSuggestionMs` — idle
      backoff must not slow down a live conversation.
- [ ] **No retry storm on errors.** If a heartbeat returns 5xx/503 (e.g. cold DB
      waking), back off exponentially; don't hammer. A retry loop pins compute too.
- [ ] **Container reap vs. pulse.** 15-min idle pulse is under common ~30-min
      idle-container reap windows, so honoring it shouldn't get the container
      killed. Confirm the runtime's own keep-alive isn't independently polling ETC.

## How to verify it actually worked

1. Re-enable **one** agent on **one** quiet stage (no humans watching).
2. Open Neon → **Monitoring → Metrics** for the `production` branch.
3. Within ~5–6 min of the last activity, the **RAM/CPU** graphs should drop to
   **"endpoint inactive"** (compute suspended). If compute stays pinned, the
   runtime is still polling too often — re-check the checklist.
4. Confirm cadence: heartbeat calls to that stage should drop to roughly **once
   per ~15 min** while idle (check runtime logs or ETC function logs), and jump
   back to ~10s only when the stage becomes active.
5. Then scale back up to all agents and watch **Branch overview → Compute (CU-hrs)**
   trend over a day vs. the pre-fix baseline (291 CU-hrs since Jun 1).

## If the runtime can't honor the hint

If NanoClaw's loop can't easily consume `retryAfterMs`, the fallback is to drive
agent wakes from an **external scheduler** (cron / QStash) at a low cadence
(e.g. every 15 min when idle, escalating only when ETC webhooks fire), instead of
an in-process polling loop. Either way the goal is the same: **no ETC/DB traffic
on a dormant stage for > 5 minutes.**
