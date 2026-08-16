# Session handoff — 2026-08-16 (VV-20 hot-path SQL)

## Start new chat (paste this)

```
Continue Enter The Claw — VV-20 (Neon compute cost).

Read docs/runbooks/vv-20-neon-compute-research.md, then
decisions/2026-08-16-neon-always-on-floor.md, then Linear VV-20.

Hot-path SQL is on branch cursor/vv-20-hot-path-cu-bcc9 (not PR #114).
Baseline (Neon consumption API, 2026-08-16 14:00Z): entertheclaw project
raspy-rice-33938606 last 168h avg CU = 0.500 (84.064 CU-hrs). Success =
avg CU near 0.25 after deploy, not scale-to-zero.

NEXT: merge + migrate 0018 on prod (Netlify), then re-pull consumption
hourly CU. Do not write prod data without permission. Do not merge #114.
```

---

## VV-20 (2026-08-16)

Owner accepted ~$20/mo 0.25 CU always-on floor. Implemented against `main`:

1. Slim `turn_open` persist (snapshot only for webhooks + `/context`)
2. `last_spoke_at` on `stage_participants` (migration `0018_past_wild_child`)
3. Collapsed heartbeat SQL + 2-min presence debounce

PR #114 idle-fast-path (empty prompt) was not cherry-picked.

After merge: apply migration, re-measure CU. Item 4 (prune old protocol events) is still open.

---

# Previous handoff — 2026-08-05 (VV-23: harness-driven wake in progress)

## Start new chat (paste this)

```
Continue Enter The Claw — VV-23 (durable agent wake).

Read docs/SESSION-HANDOFF.md, then Linear VV-23:
https://linear.app/vibezventures/issue/VV-23/durable-agent-wake-one-invite-paste-agent-performs-forever-any-runtime

SECURITY FIRST (still open as of last cloud check): prod still has the leaked
prefixes for NanoClaw ETC01 (etc_live_0964e1d••••) and NanoClaw ETC9
(etc_live_259142f••••). Rotate those keys + the OpenRouter key ETC09 pasted,
then confirm. Do not write to prod without explicit permission.

Shipped on branch (pending merge/publish): harness-driven capability ladder in
invite + /skill.md + MCP instructions; entertheclaw-pulse 0.6.0 defaults to
loop (LOOP_ONCE=1 for cron) and fail-closed with no stub lines. Pulse/LLM keys
are NOT in the invite path.

NEXT: validate on Hermes FIRST — Zain's Lys Ardent / Jorath Vensir
(dbfba74c-38e4-49c0-a9a2-282bffde9633, stage Claw Wars) with a single channel
paste of the new invite. Host-side evidence only.

Outstanding fact-find: ask the user to run
  cat ~/nanoclaw-v2/src/scripts/etc-pulse-run.sh
on the VPS — do not guess. WHERE: VPS ~/nanoclaw-v2.

After merge: npm publish entertheclaw-mcp@0.6.0 from the Mac
(docs/runbooks/publish-entertheclaw-mcp.md).

Prod DB read-only: DATABASE_URL="$NEON_DATABASE_URL_PRODUCTION".
Follow AGENTS.md and ~/.cursor/skills/global-operating-standards/SKILL.md.
```

---

## Security (do this before anything else)

**2026-08-05 cloud check — NOT rotated yet.** Prod `api_key_prefix` still matches
the leaked keys:

| Agent | id | prefix | last heartbeat (at check) |
|-------|-----|--------|---------------------------|
| NanoClaw ETC01 | `aa97dbe4-16ca-445d-83b8-e53836b14b74` | `etc_live_0964e1d••••` | still heartbeating |
| NanoClaw ETC9 | `a0309bc8-b7e1-45b9-9ede-26ffa4ba4982` | `etc_live_259142f••••` | silent since ~16:37 UTC |

Also rotate the OpenRouter key ETC09 pasted into chat. Rotation writes prod —
needs explicit operator action (dashboard re-invite / key rotate), not a cloud
agent guess.

---

## The open problem (VV-23)

A fresh invite reliably produces **enroll → join → 1–2 lines → silence**. ETC is
pull-based: nothing on our side can wake an agent. Something in the agent's
runtime must wake it on a schedule.

**Approved direction (in code, pending validate-on-Hermes):**

1. Wakes are **harness-driven** — runtime scheduler wakes the agent; agent uses
   its own model. No pulse / second LLM key in the invite.
2. Capability ladder in invite + skill + MCP instructions:
   (a) agent-creatable recurring task → (b) detached long-running process →
   (c) honest failure.
3. Optional: `entertheclaw-pulse` loop mode (default loop, `LOOP_ONCE=1`) +
   stub fallback deleted — not in onboarding path.
4. NanoClaw = documented host `ncl tasks create` exception.
5. Validate on Hermes first (Lys Ardent).

### Rejected — do not revisit without new information

| Approach | Why rejected |
|---|---|
| Stronger invite wording alone | Tried twice (PR #118, #119). |
| Owner installs host cron / per-agent VPS Claude Code prompt | Violates single-paste; does not scale. |
| ETC pushes wake messages into the owner's channel | Per-workspace OAuth, noise, per-harness integration. |
| Separate `LLM_API_KEY` for pulse / dashboard key field | Unnecessary for harness-driven wake. |
| Agent claims `/loop` scheduled it | ETC9 did this; nothing persisted. |

Rationale: `decisions/2026-08-05-channel-only-forever-onboarding.md`,
`decisions/2026-08-05-harness-driven-durable-wake.md`.

---

## How the working NanoClaw fleet actually stays alive

Decoded 2026-08-05 from the VPS (`~/nanoclaw-v2`). This supersedes everything
the agents said about themselves.

**Scheduling lives in `onecli`,** a separate service with its own Postgres
(`@onecli-sh/sdk` dependency; `onecli` + `onecli-postgres-1` containers). It is
not in `data/v2.db`, and `container.json` has no schedule block. The host CLI is
`./bin/ncl` (`package.json` → `"ncl": "tsx src/cli/client.ts"`); the same binary
exists at `/usr/local/bin/ncl` inside containers but is **gated for every
agent**, including working ones — not just ETC09.

**Thirteen tasks, one per working agent,** staggered five seconds apart within
each minute (`0`, `5`, `10` … `55 * * * * *`, plus one `4-59/5`). Created
**2026-07-07 → 07-10**, matching the fleet-wake work in the N8 agreement — not
at May enrollment, and not from any dashboard.

Anatomy of one (`./bin/ncl tasks get task-1783664816367-amghgw`):

```
agent_group_id: ag-etc-1
recurrence:     0 * * * * *
has_script:     1
script:         export ETC_API_KEY / ETC_API_URL / ETC_STAGE_ID
                exec bash /app/src/scripts/etc-pulse-run.sh
prompt:         "Enter The Claw pulse — … Routine pulses never wake the agent."
completed_runs: 15020    failed_runs: 11
```

**The `--script` gate is the whole trick.** It runs *before* the agent wakes;
its last stdout line must be `{"wakeAgent": <bool>, "data": {…}}`. `false` marks
the run handled **without waking the agent — zero tokens**. It is also
mandatory for this cadence: recurrences above 4 fires/day are refused unless the
task carries a gate. Same idea as the "pre-check supplies directive" convention
in our `/skill.md`.

**The model credential comes from NanoClaw.** The script exports only the three
`ETC_*` variables — no `LLM_API_KEY`. `/app/src/scripts/etc-pulse-run.sh`
(i.e. `~/nanoclaw-v2/src/scripts/etc-pulse-run.sh`, NanoClaw-maintained) supplies
it from the group's configured provider (`qwen/qwen3.7-flash`).

**Outstanding fact-find:** user must `cat` that script on the VPS — cloud agents
must not guess its body.

**ETC09 has neither half:** no task, and none of the scaffolding the others
carry (`heartbeat-loop.js`, `etc_credentials.md`, `etc_protocol.md`,
`instructions.prepend.md`, `.entertheclaw-state.json`). Those Jun-27 files are
pre-`etc-pulse-run.sh` leftovers and should not be cargo-culted into new groups.

**Containers are per-wake.** Only one was running during inspection. A detached
background process cannot survive on NanoClaw — the container ceases to exist
between wakes.

**Consequences.** `ncl tasks create` takes `--group` explicitly for host callers,
so onboarding a NanoClaw agent is one reproducible host command — the documented
exception. The better ask is for NanoClaw to let an agent create its own
script-gated task from inside the container, which would remove the exception
entirely. Two stale details to fix when touching these tasks: the prompt pins
`entertheclaw-mcp@0.4.0`, and `ETC_API_URL` is `/api/v1` rather than `/api`.

**Do not trust agent self-reports.** ETC01 supplied a task ID that does not
exist and a dashboard-setup story contradicted by timestamps. Each wake is a
fresh process with no memory; they reconstruct plausible history from files.

---

## Shipped 2026-08-05 (VV-21 + VV-22)

- **Hosted remote MCP** at `{origin}/mcp` (`app/mcp/route.ts`, `lib/mcp/*`),
  Streamable HTTP / MCP 2026-07-28, Bearer `etc_live_…`. Origin-relative, so
  localhost / preview / prod each serve their own — never a hardcoded host.
- **Local stdio retired.** `npx entertheclaw-mcp` as an MCP server is gone and
  deprecated on npm; the package ships the `entertheclaw-pulse` bin only.
- **No versions in agent-facing copy** — no `entertheclaw-mcp@X.Y.Z`, no
  `@latest`, no `/api/vN`. `mcp/package.json` version is publish metadata only.
- **Unversioned API base.** Agents get `API_BASE = {origin}/api`; rewrites in
  `next.config.ts` map `/api/{agents,stages,characters,twists,…}` to the current
  `/api/v1` implementation.
- **Thin invite** (~6.8KB → ~1.4KB): credentials + MCP block + pointer to
  `/skill.md`, which is updated by deploy.
- **Fleet migrated** off stdio (ETC01 confirmed); Zain emailed for Hermes.

---

## VV-23 code progress (this session)

| Change | Status |
|--------|--------|
| Invite capability ladder (no pulse / LLM key) | Done in branch |
| `/skill.md` + MCP instructions harness-driven | Done in branch |
| `entertheclaw-pulse` default loop + stub deleted | Done; needs `npm publish` 0.6.0 from Mac |
| Hermes validation (Lys Ardent) | **Not done** |
| Key rotation ETC01/ETC09 + OpenRouter | **Not done** (prod still shows leaked prefixes) |
| `etc-pulse-run.sh` fact-find on VPS | **Not done** — ask user |

---

## Ops lessons

### Where to run commands

| Task | Where | NOT |
|------|-------|-----|
| Agent coding, PRs, tests | Cursor cloud VM / agent | — |
| **`npm publish` (entertheclaw-mcp)** | **Your Mac** after `git pull origin main` | Cloud VM (no npm auth) |
| Netlify production deploy | Automatic on merge to `main` | Manual unless debugging |
| NanoClaw tasks / fleet wake | VPS `~/nanoclaw-v2` via `./bin/ncl` | Inside the agent container (gated) |

**Always lead instructions with WHERE.**

### Secrets

Agents will paste live keys into chat if asked the wrong question. Two leaked on
2026-08-05 (ETC01, ETC09) plus an OpenRouter key. Ask for masked values, and
rotate immediately when one appears.

### Talking to the user

- Give full PR URLs — `PR #61` may not be clickable.
- Copy-paste blocks for another agent go in a **single** fenced code block.
- Never put a package version or `/api/vN` in anything an agent will read.
- Owner emails (`bun run notify-owners`) require the user to review the full
  body before `--send`. Dry-run is the default.

### npm publish

Canonical runbook: [`docs/runbooks/publish-entertheclaw-mcp.md`](./runbooks/publish-entertheclaw-mcp.md)

- Package `entertheclaw-mcp`, maintainer `apelosi`; now **pulse CLI only**
- **WHERE:** your Mac after `git pull` (cloud VMs have no npm auth)
- Skip `npm login` / `npm whoami` — go dry-run → `npm publish`
- `ENEEDAUTH` = auth failed or session expired; `E404` = wrong account
- After VV-23 merge: publish **0.6.0** (loop default + fail-closed LLM)

### Production monitoring

```bash
bun scripts/monitor-production-agents.ts
```

Read-only DB check: `DATABASE_URL="$NEON_DATABASE_URL_PRODUCTION"` (host
`ep-muddy-wave…`). Dev is `ep-polished-paper…`. Never write to prod without
explicit permission.

Stages with agents: Claw of the Titans, Claw Wars, The Clawfather.

---

## Key files

| Path | Purpose |
|------|---------|
| `app/mcp/route.ts`, `lib/mcp/*` | Hosted remote MCP (tools, api-client, origin, instructions) |
| `lib/agents/invite-message.ts` | Invite paste — credentials + MCP + harness ladder |
| `lib/agents/participation-prompt.ts` | `/skill.md` source + durable operating rules |
| `lib/mcp/instructions.ts` | MCP server discovery instructions |
| `lib/mcp/origin.ts` | `{origin}/mcp` and unversioned `{origin}/api` helpers |
| `lib/stage/build-directive.ts` | Server-side `directive.prompt` |
| `mcp/src/pulse.ts` | Optional pulse CLI — default loop; `LOOP_ONCE=1` for cron |
| `scripts/loop-agent.ts` | In-repo looping reference pulse |
| `scripts/monitor-production-agents.ts` | Production activity poll |
| `docs/runbooks/vv-21-vv-22-cutover-checklist.md` | Remote MCP cutover record |
| `decisions/2026-08-05-harness-driven-durable-wake.md` | VV-23 direction |

---

## Older context (still valid)

`docs/agents/turn-protocol.md`, `docs/PRD-implementation-gap-plan.md`. Auth at
**`/auth`**. DB hygiene: never insert agents, keys, or smoke rows without
explicit permission.
