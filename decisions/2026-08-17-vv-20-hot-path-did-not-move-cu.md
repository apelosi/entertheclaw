## Decision: Hot-path SQL was the wrong lever for Neon CU-hrs; next lever is compute size + working set

## Context

VV-20 success criterion (owner, 2026-08-16): **keep average CU near 0.25** while stages stay live. Scale-to-zero is not the product. Floor at 0.25 CU always-on ≈ $20/mo is acceptable; the extra ~$13/mo in July was “running hotter than 0.25.”

PR [#148](https://github.com/apelosi/entertheclaw/pull/148) shipped research items 1–3 (slim `turn_open`, `last_spoke_at`, collapsed heartbeat). Migration `0018` applied on prod. App code went live with [#149](https://github.com/apelosi/entertheclaw/pull/149) at **2026-08-16T15:09:56Z**. Linear VV-20 was marked **Done** when the PR merged — before the success metric was measured.

~11.5 hours later, billed CU was unchanged. This document is the retrospective the follow-up owed and did not write until the owner asked.

## What actually shipped (the work was real)

Live on `ep-muddy-wave` as of 2026-08-17 02:43Z (read-only):

| Check | Result |
| --- | --- |
| New `turn_open` rows | **1080** after publish, **150 bytes** avg (was **3716** bytes with snapshot) |
| Historical fat snapshots | still **~102k** rows / **364 MB** `turn_open` content / **417 MB** TOAST |
| `last_spoke_at` | 20/20 participants populated; latest speak 02:43Z |
| New claim LRU SQL | `select agent_id, last_spoke_at …` **1090** calls, **0.02 ms** mean |
| New heartbeat SQL | one `json_build_object` **4309** calls, **0.92 ms** mean |
| Old `getLastSpokenMap` aggregate | still in `pg_stat_statements` (**24,598** calls, **19 ms**) because stats_reset is **2026-08-05** — cumulative, not proof the old path still runs |

SQL got cheaper. The bill did not.

## What the bill did

Neon consumption `compute_unit_seconds` (project `raspy-rice-33938606`, Launch):

| Window | avg CU |
| --- | --- |
| 24h before publish | **0.507** |
| 10 complete hours after publish (16:00Z–02:00Z) | **0.500** (every hour **1800** CU-seconds) |
| Autoscaling config | min **0.25** / max **8** (API confirmed) |
| Live LFC soft limit | `neon.file_cache_size_limit` = **1461 MB** → allocated size is **0.5 CU** (2 GB RAM / ~1.5 GB cache), not 0.25 |

Pinned at half a compute unit, all day, before and after. Not a measurement lag, not an unpublished deploy.

## Why we thought items 1–3 would move CU

The 2026-08-16 plan treated “hottest query + snapshot bloat + heartbeat fan-out” as the reason average CU sat at ~0.5 instead of 0.25. That mixed two different machines:

1. **Postgres query cost** (ms, calls, seq scans) — we measured this well. Wall-clock SQL busy was already **0.092%**.
2. **Neon billed CU-hrs** = **allocated compute size × hours awake**. Size is chosen by the autoscaler:

```
goalCU = max(cpuGoalCU, memGoalCU, lfcGoalCU)
```

CPU was already ~0, so cutting query latency cannot shrink `cpuGoalCU`. Autoscaling watches **RAM and Local File Cache working set**, not “how many neon-http round-trips the app made.”

We optimized (1) and used it as a proxy for (2). That proxy was wrong given the evidence we already had (CPU ~0, allocated RAM ~1.5–2.15 GB, bill = awake × size).

## Why CU stayed at 0.5 (best current evidence)

Live working set on the compute (`neon.approximate_working_set_size_seconds` in database `postgres`):

| Window | Distinct pages | Size |
| --- | --- | --- |
| 1 min | 60,164 | **470 MB** |
| 1 hour | 60,362 | **472 MB** |

Database `neondb` is **604 MB**; `stage_events` is **595 MB** of that (**417 MB TOAST**). The working set is essentially “touch most of the event log, including historical snapshot toast.”

0.25 CU has **1 GB RAM / 0.75 GB cache**. 470 MB *can* fit, so LFC size alone does not prove 0.5 is required. What we *do* know:

- The endpoint has been **Active since 2026-08-05** (`started_at`) and bills **exactly 0.5 CU every complete hour**.
- LFC is sized for 0.5 CU (**1461 MB**). Autoscaler has not stepped down.
- New slim `turn_open` rows stop *growth*; they do not remove the **364 MB** of old snapshots still in TOAST, so the working set does not shrink by shipping 1–3.
- Closing VV-20 on merge assumed the causal chain “less SQL → smaller CU.” That chain failed.

We are **not** claiming prune-snapshots will definitely drop CU to 0.25. That would be the same mistake again. Prune is the next *evidence-aligned* experiment because it is the remaining mass in the working set. The *direct* bill lever is Neon compute size.

## Alternatives considered now

1. **Wait longer / re-pull consumption** — rejected. Ten complete hours at exactly 1800 CU-sec is the answer.
2. **More heartbeat SQL shaving** — rejected as a CU-hr tactic. Already 0.92 ms. Will not change `goalCU`.
3. **Merge PR #114 idle fast-path** — rejected. Empties `directive.prompt`; owner already forbade gutting act=true context; premise is still scale-to-zero.
4. **Chase scale-to-zero** — rejected (product law).
5. **Force 0.25 CU (min = max = 0.25)** — **next ops experiment.** Restarts the endpoint. Working set 470 MB vs 750 MB cache is tight but plausible. Needs explicit owner permission (Neon API PATCH).
6. **Strip historical `content.snapshot` then re-measure working set + CU** — **next data experiment.** Needs explicit owner permission (prod writes). Dry-run script only until then.
7. **Accept 0.5 CU as the real always-on floor (~$40/mo)** — owner call if 5+6 fail. Do not pretend 0.25 is happening.

## Reasoning

Marking the SQL PR as the VV-20 fix was a process failure: the success metric is average CU, and we declared victory on merge. The code is still worth keeping (claim LRU no longer scales with dialogue history; new snapshot writes stopped; heartbeat is one round-trip). It is **hygiene and latency**, not the $13/mo.

The $13/mo is **0.5 CU vs 0.25 CU while always awake**. Moving that number requires either Neon allocating 0.25, or a working set that lets the autoscaler choose 0.25, measured after the change — not inferred from query rankings.

## Trade-offs accepted

- Do not run another “optimize hot SQL and hope CU drops” cycle.
- Do not PATCH the production endpoint or UPDATE `stage_events` without explicit owner permission.
- Keep PR #114 unmerged.
- Reopen VV-20 until average CU is near 0.25 **or** the owner accepts 0.5 CU as the floor.

## Next plan (ordered, stop at first success)

Success = Neon hourly `compute_unit_seconds` ≈ **900**/hour (0.25 CU), not 1800. Re-pull the same consumption API. Do not mark Done on merge.

1. **Ops (highest chance to move the bill):** PATCH `ep-muddy-wave-ao62fing` to **min CU = max CU = 0.25** (fixed 0.25). Restarts compute. Watch dialogue latency + CU for 24h. Rollback = restore min 0.25 / max 8.
2. **Data:** `bun run db:strip-turn-open-snapshots -- --database-url=…` (dry-run default; `--yes` only after permission). Removes `content.snapshot` from historical `turn_open` (~102k rows / ~364 MB). Re-measure working set pages and CU-hrs. No `VACUUM FULL` unless a later pass needs it (locks the live table).
3. **If still 0.5 after 1+2:** treat 0.5 CU as the observed always-on class for this dataset; update the $20 floor decision; stop spending engineering on CU-hr theater. Optional later: archive old `turn_claim`/`turn_grant`, stop selecting fat `content` on protocol reads, presence off Postgres only if the new floor is unacceptable.

Canonical runbook: `docs/runbooks/vv-20-neon-compute-research.md`.
