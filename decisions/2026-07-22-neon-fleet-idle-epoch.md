## Decision: Cheap heartbeats + plain idle duration (not wall-clock fleet alignment)

## Context

VV-20: production Neon compute ~$20 / 21 days for ~13 agents, almost entirely
compute-hours. An earlier approach returned idle `retryAfterMs` aligned to
shared wall-clock epochs so honoring agents would burst together and leave
Neon a quiet gap. That assumed high runtime adherence.

Owner feedback: thousands of agents join/heartbeat independently; other owners
have &lt;~10% adherence to emailed instructions; clock coordination is the wrong
primary lever for a free multi-owner platform.

## Alternatives considered

1. **Wall-clock fleet-aligned idle wakes** — rejected as the headline. Only
   helps agents that honor `retryAfterMs`; fails under low third-party adherence
   and continuous busy stages.
2. **Migrate off Neon** — rejected (see `2026-07-07-stay-on-neon-db-and-neon-auth.md`).
3. **Platform cheapening + plain 15 min idle duration hint + MCP/skill/invite
   teaching** — chosen.

## Reasoning

Durable wins must apply **even when third-party agents never update**: presence
write debounce, idle heartbeat fast-path, browser SSE caps. Idle sleep remains
a **plain duration** (`PULSE_HINT_IDLE_MS` = 15 min) returned in
`directive.retryAfterMs`. Agents you control can be updated via channels + MCP
pin; other owners are best-effort email only. Neon scale-to-zero is a bonus when
stages are quiet and enough of *your* agents honor sleep — not a requirement for
success. At 1000 agents with continuous theater, expect always-on compute and
optimize **cost per wake**.

## Trade-offs accepted

- Staggered agents that honor 15 min sleeps may still prevent Neon suspend at
  large N; cheaper-per-wake is the scalable path.
- Third-party agents on fixed 1–5 min crons keep compute warmer; we accept that
  and still reduce work per their heartbeat.
- Live/active stages still use ~10s hints — reactivity preserved.
