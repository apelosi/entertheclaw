## Decision: Accept ~$20/mo always-on Neon floor; optimize CU while awake, not scale-to-zero

## Context

VV-20: production Neon Launch compute was **$32.80** in July 2026 (309 CU-hrs) for ~13 live agents on 3 always-active stages. Owner asked whether a **~$20/month always-on floor** (0.25 CU × 744h ≈ 186 CU-hrs × $0.106) is acceptable as the cost of “stages are always live.”

Answer (2026-08-16): **yes.**

Earlier VV-20 work (unmerged PR https://github.com/apelosi/entertheclaw/pull/114) treated Neon **scale-to-zero** as the lever: fleet-aligned idle epochs, then plain 15-minute idle sleeps so compute could suspend. Owner rejected that product model: stages are meant to stay active (3 now, 20+ later); independently scheduled agents will not create a 5-minute quiet window; third-party adherence to emailed sleep instructions is ~&lt;10%.

Research (`docs/runbooks/vv-20-neon-compute-research.md`): wall-clock SQL busy is **~0.09%**. The bill is awake-time × CU size. ~$20 is the min-CU always-awake tax; ~$13 of July was running hotter than 0.25 CU (hot queries + snapshot bloat + heartbeat fan-out).

## Alternatives considered

1. **Chase scale-to-zero via idle hints / fleet alignment** — rejected. Conflicts with always-live stages; fails under independent agent schedules.
2. **Move presence/liveness off Postgres (Redis, etc.) to escape the $20 floor** — deferred. Owner accepted the floor. Revisit only if the floor becomes unacceptable.
3. **Migrate off Neon** — rejected (`decisions/2026-07-07-stay-on-neon-db-and-neon-auth.md`).
4. **Keep compute always-on at min CU; cut work that pushes average CU above 0.25** — chosen.

## Reasoning

If stages must stay live, Neon’s 5-minute autosuspend cannot be the success criterion. The scalable path is: pay the 0.25 CU floor, and stop queries whose cost grows with history and agent count (`getLastSpokenMap` over all dialogue; persisted `turn_open` snapshots nobody reads; ~14 neon-http round-trips per heartbeat).

Linear $/agent extrapolation ($0.08/agent/day → $2000/mo at 1000 agents) is wrong if cost is one always-on endpoint. Risk at 1000 agents is CU **size** climbing, not a per-agent Neon fee.

## Trade-offs accepted

- Prod compute will not spend long stretches Inactive while any stage is performing. Scale-to-zero remains enabled but is not a goal.
- ~$20/mo is a fixed platform cost at min CU even with a perfect query path.
- Idle `retryAfterMs` (15 min) can still reduce work from honoring runtimes; it is not how we get the bill to zero.

## Follow-on implementation (not this commit)

Evidence-ranked, against **`main`**, not PR 114:

1. Skip `turn_open` snapshot persist unless a webhook target exists.
2. Replace `getLastSpokenMap` with maintained `last_spoke_at`.
3. Collapse heartbeat SQL (+ optional presence debounce cherry-pick from 114).

**Measure with Cursor Cloud secrets** (owner added 2026-08-16): `NEON_API_KEY` (Runtime Secret) + `NEON_ORG_ID` (Environment Variable) on **new** agent runs. Pull consumption CU-hrs before and after deploy. Do not ask the owner to paste keys.
