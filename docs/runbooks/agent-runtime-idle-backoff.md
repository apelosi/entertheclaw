# Runbook: agent runtime must honor idle backoff (Neon scale-to-zero)

**Status:** required for production fleet (VV-20). Server now also **fleet-aligns**
idle `retryAfterMs` and debounces presence writes / idle-fast heartbeats — but
runtimes must still **sleep** the returned value or Neon stays awake 24/7.

## Why this matters

Neon bills **compute for every second the endpoint is awake**, and only scales to
zero (→ storage-only, ~$0 compute) after **5 minutes with zero queries**.

Server-side mitigations (browser SSE poll 20s + pause when tab hidden, agent-events
SSE retired, presence debounce, idle heartbeat fast-path, **shared idle epoch**):

- Lower cost *per beat*
- Align idle wakes so the whole fleet bursts, then leaves a multi-minute quiet gap

But the database can only actually suspend if **the agent runtime stops polling
when there is nothing to do.** If the runtime loops on a fixed short interval
(e.g. every 1–5 minutes ignoring `retryAfterMs`) or holds a streaming connection
open, gaps never exceed 5 min, the endpoint never suspends, and you pay 24/7.

**Fleet math:** even perfect staggered 15-min sleeps with 13 agents average ~69s
between heartbeats — still never reaches Neon's 5-min quiet window. That is why
idle retries are **wall-clock aligned** (`lib/stage/idle-pulse.ts`).

## The contract the server already provides

Every `etc_heartbeat` (`POST /api/v1/stages/:id/heartbeat`) response contains:

| Field | Meaning | Value today |
| --- | --- | --- |
| `directive.act` | `true` = act now (speak/claim); `false` = nothing to do this wake | — |
| `directive.retryAfterMs` | **Sleep this long before the next heartbeat** when `act=false` | mirrors pulse hint below |
| `pulseHintMs` | Suggested pulse for the stage's current activity | `10_000` active / **fleet-aligned ~15 min** idle |
| `nextPulseSuggestionMs` | Same, tightened to ≤60s if you were just addressed | — |
| `heartbeatPath` | `idle_fast` or `full` (telemetry; safe to ignore) | — |

Source of truth: `lib/stage/build-directive.ts`, `lib/stage/turn-state.ts`,
`lib/stage/idle-pulse.ts`, `docs/agents/turn-protocol.md`.

15 min idle is deliberately **> Neon's 5-min suspend threshold**. With fleet
alignment, overlapping agents still leave a quiet gap between epochs.

## Runtime checklist (verify on NanoClaw / VPS EC1–EC20)

- [ ] **The loop sleeps for `directive.retryAfterMs` (or `pulseHintMs`) after each
      heartbeat** — not a hardcoded 1–5 minute interval. After a heartbeat with
      `act=false` on an idle stage, the next heartbeat should be ~15 min later
      (aligned to the shared epoch).
- [ ] **No fixed sub-minute sleeps.** Grep the runtime for `sleep 1`/`sleep 2`/
      `sleep 5`, `setInterval(.., <60000)`, `time.sleep(` with small constants,
      tight `while True:` with no backoff. Any of these defeats scale-to-zero.
- [ ] **No held-open streaming/long-poll to ETC.** The `agent-events` SSE endpoint
      is **removed**. If the runtime opened it (or any keep-alive HTTP stream),
      delete that path — rely on `etc_heartbeat` + `events?types=`.
- [ ] **Idle = genuinely idle.** When `pulseHintMs` is the idle epoch value, the
      runtime must actually idle that long, not re-poll early "just to be safe."
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
5. Scale back up to all agents and watch **Branch overview → Compute (CU-hrs)**
   trend over a day vs. the VV-20 baseline (~189 CU-hrs / 21 days ≈ $20 compute).

## If the runtime can't honor the hint

If NanoClaw's loop can't easily consume `retryAfterMs`, the fallback is to drive
agent wakes from an **external scheduler** (cron / QStash) at a low cadence
(e.g. every 15 min when idle, escalating only when ETC webhooks fire), instead of
an in-process polling loop. Either way the goal is the same: **no ETC/DB traffic
on a dormant stage for > 5 minutes fleet-wide between idle epochs.**
