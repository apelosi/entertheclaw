# VV-20 — Neon compute research (canonical)

**Issue:** [VV-20](https://linear.app/vibezventures/issue/VV-20/reduce-neon-compute-costs-agent-mcp-heartbeats-keep-prod-compute-awake)
**Status:** research complete; owner accepted always-on floor; **do not implement until a plan is confirmed in a follow-up chat.**
**Product decision:** `decisions/2026-08-16-neon-always-on-floor.md`

This file is the durable dump of the Jul–Aug 2026 investigation so a new chat can continue without the original thread.

## Owner prompt that started the deep research (2026-08-05)

> After monitoring Neon compute spend, it is still way too expensive, just over $1/day for 13 active agents, it is not scalable to hundreds let along thousands of agents. See attached from Neon.
>
> Do not attempt to fix, just conduct research into the codebase, Neon, possible root causes, and then update Linear with all of this information including the attachments. We will work on possible solutions and fixing later.

Later corrections from the owner (treat as product law):

1. **Fleet-aligned idle epochs are wrong.** Thousands of independently scheduled agents; other owners have &lt;~10% adherence to emailed instructions. Do not depend on clock sync or third-party sleep.
2. **Stages are always meant to be active** (3 now, 20+ later). Idle / Neon scale-to-zero is not the product.
3. **~$20/month always-on floor is acceptable** (0.25 CU × 744h ≈ 186 CU-hrs × $0.106 ≈ $19.70). That is the cost of “stages are always live.”

## What “too expensive” actually is

| Source | Number |
| --- | --- |
| Invoice **UVLHZT-00007** (Jul 1–31 2026) | **$33.00** total |
| Compute | **309.473 CU-hrs × $0.106 = $32.80** |
| Storage / transfer | pennies |
| Per day | **~$1.06** for ~13 live agents |
| Always-on floor at min 0.25 CU | 0.25 × 744h = **186 CU-hrs ≈ $19.70** |
| Remainder | **~$13/mo** = running hotter than 0.25 CU (avg ~**0.42 CU**) |
| MTD Aug 1 snapshot (console) | **49.81 CU-hrs** in ~4 days — still ~0.5 CU average |

Neon bills **CU-hours = compute size × hours the endpoint is awake**. CPU ~0. Suspended = $0. Scale-to-zero is ON @ 5 min and **does not matter** while stages stay live.

**Wrong extrapolation (in the original Linear description):** $0.08/agent/day → $2000/mo at 1000 agents. Cost is **one always-on endpoint**, not a per-agent Neon fee. 13 → 1000 agents is ~0.09% → ~7% SQL busy **if** the hot queries are fixed; still ~1 CU. Real scale risk is **CU climbing with history/QPS**, especially `getLastSpokenMap` + `turn_open` snapshot bloat.

## Neon dashboard myths (debunked)

| Myth | Fact |
| --- | --- |
| TOTAL ≈ 905 live connections | **MAX** is `max_connections` for the compute size (Neon example: 2 CU → 901). Owner Aug 5 tooltip: Idle:5 Total:5 Max:901. Live `pg_stat_activity` ~14 idle + 1 active. |
| CPU / RAM pressure | CPU ~0. Allocated RAM ~1.5–2.15 GB is the **awake compute size**, not query load. |
| Need to leave connections open | App uses `@neondatabase/serverless` + `drizzle-orm/neon-http` (`lib/db/client.ts`). **No long-lived PG sockets.** |
| Storage is the bill | Invoice storage is $0.20. |

## Live prod SQL (read-only, 2026-08-12)

Connected as `neondb_owner` via Cursor secret `NEON_DATABASE_URL_PRODUCTION` → `ep-muddy-wave` pooler.

**`pg_stat_statements` lives in database `postgres`, not `neondb`.** Window ~**163.4 hours** (stats_reset 2026-08-05).

| | |
| --- | --- |
| App queries | 1,626,516 (~2.77/sec — never a 5-min gap) |
| All statements | 14,486,443 |
| Exec time | **541.7s** |
| Wall-clock busy | **0.092%** |

Paid for ~163h of compute to do ~**9 minutes** of SQL. The bill is **awake tax + CU size**, not CPU.

### Hottest app query (~47% of exec time)

```sql
select agent_id, max(created_at) from stage_events
where stage_id = $1 and type = $2 group by agent_id
```

- 14,376 calls, 256.7s, **17.9ms mean**
- `getLastSpokenMap()` in `lib/stage/turn-state.ts`
- Called from `POST /api/v1/stages/:id/turn/claim`
- **Gets slower as dialogue history grows** (no `last_spoke_at` column)

#2: `getLastDialogueByAgent()` in `lib/stage/agent-activity-status.ts` (cron) — 389 calls, 58.9ms mean. Same shape, agent-id list.

### neon-http housekeeping (not app SQL, volume ∝ statement count)

`RESET ALL` / `SET SESSION AUTHORIZATION DEFAULT` / `UNLISTEN *` / `DEALLOCATE ALL` / `DISCARD *` / `pg_advisory_unlock_all` each **~1,607,319** times. One HTTP checkout per statement. Heartbeat `Promise.all` of ~12–16 queries → ~14 checkouts × ~9 housekeeping commands.

### `stage_events` bloat (prod snapshot Aug 12)

Table ~**523 MB**, ~290k rows.

| type | rows | content |
| --- | --- | --- |
| `turn_open` | 92,704 | **325 MB**, ~3679 B each (**snapshots**) |
| dialogue | 63,246 | 45 MB |
| `turn_grant` | 66,842 | 16 MB |
| `turn_claim` | 66,893 | 6.9 MB |

Last 24h: ~2041 dialogue vs ~6405 turn_open/claim/grant. ~2150 `turn_open`/day.

Indexes exist: `stage_events_pkey`, `idx_stage_events_stage_created`, `idx_stage_events_stage_type_created`. Many seq scans still on small tables (`stage_participants` 2.8M seq scans).

### Unused snapshots

- `emitTurnOpen` **always** calls `buildTurnOpenSnapshot` and stores it in `stage_events.content` (`lib/stage/emit-turn-open.ts`).
- Heartbeat **strips** snapshot via `slimEvent`.
- `GET /api/v1/stages/:id/context` **rebuilds** via `buildTurnOpenSnapshot()`.
- **0 of 21 agents** had `webhook_url` on Aug 12. Snapshot is unused except webhook payload.
- ~4 extra queries × 2150/day ≈ 8600 wasted queries/day + 325 MB bloat.

### Heartbeat on **production `main`** (PR 114 is **not** merged)

Every pulse still:

- **2 UPDATEs** (`agents.lastHeartbeatAt`, `stageParticipants.lastActiveAt`)
- **~10–14 SELECTs** in `Promise.all`
- `act=false` is **not cheaper**
- `PULSE_HINT_ACTIVE_MS=10s`, `PULSE_HINT_IDLE_MS=15min`
- Browser SSE `POLL_INTERVAL_MS=10_000` on main (PR 114 had 20s + hide-tab; unmerged)

Cron: `netlify/functions/turn-open-tick.mts` `*/30 * * * *`.

Live fleet Aug 12: 13 LIVE / 1 quiet (Jorath) on 3 stages; dialogue every 1–2 min.

## PR #114 — do not treat as the solution

- Branch: `cursor/neon-compute-cost-vv20-ed1d`
- PR: https://github.com/apelosi/entertheclaw/pull/114 — **OPEN, DRAFT, unmerged**, stale vs `main`
- First implementation: wall-clock “fleet-aligned idle epoch” — **owner rejected**
- Revision dropped epoch; kept presence debounce, idle fast-path, SSE 20s + `document.hidden`, plain 15m `retryAfterMs`
- Premise still “sleep so Neon suspends”
- **Implement the real fix against `main`.** Close or retarget 114. Cherry-pick debounce + cheaper heartbeat only if they still fit the always-on plan.

Hosted MCP (`GET|POST /mcp`) does **not** by itself change Neon query shape. Agents still hit Next.js `/api/v1` heartbeat/claim/speak.

## Ranked next work (evidence order)

Success metric with the accepted floor: **keep average CU near 0.25** as agents/stages grow. Not “get Neon to suspend.”

1. **Stop building/persisting `turn_open` snapshots** unless a webhook target exists. Skip `buildTurnOpenSnapshot` in `emitTurnOpen` when no webhooks. Optionally strip historical `content.snapshot` (325 MB). Heartbeat already slims; `/context` rebuilds.
2. **Replace `getLastSpokenMap`** with a maintained `last_spoke_at` (e.g. on `stage_participants`) updated on dialogue insert — kills the growth curve on every claim.
3. **Collapse heartbeat** from ~14 round-trips to 1–2 SQL (plus presence debounce from 114 if still useful).
4. Prune/archive old protocol events (`turn_open` / `claim` / `grant`).
5. Optional later: presence/liveness off Postgres **only if** the $20 floor becomes unacceptable (owner said it is acceptable).

Do **not** break agent-authored lines / `directive.prompt` on `act=true`.

## Secrets — where they go

| Secret | Purpose | Where |
| --- | --- | --- |
| `NEON_DATABASE_URL_PRODUCTION` | Read-only (or explicit-write) SQL vs prod `ep-muddy-wave` | **Cursor Cloud Agent secret** (already injected) |
| `NEON_API_KEY` | Neon **management** API (consumption CU-hrs) | Cursor Cloud **Runtime Secret**. Not `.env.local`. Not needed on Netlify unless app code reads it (it does not). |
| `NEON_ORG_ID` | Neon consumption API `org_id` | Cursor Cloud **Environment Variable** (non-secret id). Same “not Netlify / not `.env.local`” rule. |
| `NEON_PROJECT_ID` | Optional convenience | Cursor Cloud Environment Variable |

New Cursor secrets apply to **new agent runs only**. After adding keys, start a fresh chat.

Neon consumption API (when key is present):

```
GET https://console.neon.tech/api/v2/consumption_history/v2/projects?org_id=&metrics=compute_unit_seconds&granularity=hourly|daily&from=&to=
GET https://console.neon.tech/api/v2/projects/{id}  → compute_time_seconds / active_time_seconds → average CU
```

Do **not** put the API key in `.env.local` (iCloud, local **dev** branch). Do **not** wire it into the Next.js app unless a product feature needs it.

## Constraints (do not violate)

- Stay on Neon (`decisions/2026-07-07-stay-on-neon-db-and-neon-auth.md`).
- EC1–20 = prod API `https://entertheclaw.com/api/v1`. Never generate prod invite keys for local NanoClaws.
- No smoke/bootstrap inserts without explicit permission.
- Prod writes need explicit permission. Research SQL was read-only.

## Linear comments already posted

- 2026-07-21 — RAM allocation screenshots
- 2026-07-22 — Phase 1 diagnosis, Phase 2/3 (PR 114, later superseded premise)
- 2026-07-23 — drop wall-clock fleet alignment
- 2026-08-05 — invoice + query-performance transcription; MAX vs TOTAL clarification
- 2026-08-16 — Aug 12 `pg_stat_statements` + always-on floor accepted (this handoff)

Invoice PDF and Neon screenshots live as Linear attachments on VV-20.
