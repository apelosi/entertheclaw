# Session handoff — 2026-08-05 (remote MCP shipped; durable wake is the open problem)

## Start new chat (paste this)

```
Continue Enter The Claw — now working VV-23 (durable agent wake).

Read docs/SESSION-HANDOFF.md, then Linear VV-23:
https://linear.app/vibezventures/issue/VV-23/durable-agent-wake-one-invite-paste-agent-performs-forever-any-runtime

Context: VV-21 (hosted remote MCP at {origin}/mcp) and VV-22 (thin invites, no
package versions, unversioned API_BASE={origin}/api) are DONE and merged.

THE GOAL, which overrides everything: an owner pastes ONE invite into the
channel they already use to talk to their agent (Slack/WhatsApp/Telegram) and
that agent performs on stage FOREVER. No second message, no dashboard step, no
VPS/host access, no per-runtime hand-holding. Must work for NanoClaw, Hermes,
OpenClaw, etc. Never propose host cron, per-agent VPS Claude Code prompts, ETC
posting into the owner's channel, or a second API key — all were evaluated and
rejected (decisions/2026-08-05-channel-only-forever-onboarding.md).

FIRST, SECURITY: two live keys leaked into chat today and must be rotated —
ETC01's etc_live_0964e1dd… and ETC09's etc_live_259142f… plus the OpenRouter
key ETC09 pasted. Confirm with the user that rotation happened.

Approved direction (agreed after decoding how the working fleet stays alive):
1. Wakes are HARNESS-DRIVEN. The runtime's scheduler wakes the agent; the agent
   heartbeats and obeys the directive using ITS OWN configured model. Do not put
   entertheclaw-pulse or any LLM_API_KEY in the onboarding path — the runtime
   already owns the model credential.
2. Rewrite invite (lib/agents/invite-message.ts), /skill.md
   (lib/agents/participation-prompt.ts), and MCP server instructions
   (lib/mcp/instructions.ts) around a capability ladder:
   (a) runtime's own agent-creatable recurring task,
   (b) else a detached long-running process (Hermes/OpenClaw),
   (c) else report honestly that setup cannot complete — never fake success.
3. Optional, not in the onboarding path: ship loop mode in the published pulse
   CLI for rung (b). mcp/src/pulse.ts is one-shot — it computes the next sleep
   then exits; the loop already exists unpublished in scripts/loop-agent.ts.
   Also DELETE its stub fallback: with no LLM key it posts a canned line
   ("[considers the moment] X weighs what to say next.") instead of failing.
4. NanoClaw is a documented exception: one host command per new agent
   (./bin/ncl tasks create --group ag-etc-N …). See the NanoClaw section of
   SESSION-HANDOFF for the exact anatomy of a working task.
5. Validate on Hermes FIRST (Zain's agent Lys Ardent / Jorath Vensir,
   dbfba74c-38e4-49c0-a9a2-282bffde9633, stage Claw Wars). Hermes has cron and a
   persistent daemon, so it can meet the bar with no exception.

Outstanding fact-find: cat ~/nanoclaw-v2/src/scripts/etc-pulse-run.sh on the VPS
— it shows how the gate decides wakeAgent and where the model credential comes
from. Ask the user to run it; do not guess.

Never trust an agent's account of its own history. ETC01 invented a task ID and
a dashboard-setup story that host evidence disproved. Only host-side output counts.

Prod DB for read-only checks: DATABASE_URL="$NEON_DATABASE_URL_PRODUCTION".
Never write to prod without explicit permission. Follow AGENTS.md and
~/.cursor/skills/global-operating-standards/SKILL.md.
```

---

## The open problem (VV-23)

A fresh invite reliably produces **enroll → join → 1–2 lines → silence**. ETC is
pull-based: nothing on our side can wake an agent, and
`POST /stages/:id/heartbeat` is the agent calling us, not a timer we control. So
something in the agent's runtime must wake it on a schedule — and most agents
cannot create that for themselves.

**Evidence (2026-08-05, production):**

- **NanoClaw ETC9** — enrolled 12:24 UTC, last heartbeat 12:30 UTC. Two clean
  claim → grant → dialogue cycles over hosted remote MCP, then nothing. The
  stage kept going without it (81+ lines from others in the same window).
- **Lys Ardent** (Zain's Hermes agent) — identical failure months earlier,
  silent 12+ days. No owner email could have fixed it.
- **The 13 survivors** — alive only because of host-side `ncl` tasks created
  during the July fleet-wake work. No agent created its own.

### Rejected — do not revisit without new information

| Approach | Why rejected |
|---|---|
| Stronger invite wording | Tried twice (PR #118, #119). Cannot create capability a runtime forbids. |
| Owner installs host cron / per-agent VPS Claude Code prompt | Violates the single-paste requirement; does not scale past our own fleet. |
| ETC pushes wake messages into the owner's channel | Per-workspace OAuth/token setup, constant message noise, a new integration per harness. |
| Separate `LLM_API_KEY` for the pulse / dashboard key field | Unnecessary — a harness-driven wake uses the runtime's own model. |
| Agent claims `/loop` scheduled it | ETC9 did exactly this; nothing persisted. |

Rationale: `decisions/2026-08-05-channel-only-forever-onboarding.md`.

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
| `lib/agents/invite-message.ts` | Invite paste — credentials + MCP + skill pointer |
| `lib/agents/participation-prompt.ts` | `/skill.md` source + durable operating rules |
| `lib/mcp/instructions.ts` | MCP server discovery instructions |
| `lib/mcp/origin.ts` | `{origin}/mcp` and unversioned `{origin}/api` helpers |
| `lib/stage/build-directive.ts` | Server-side `directive.prompt` |
| `mcp/src/pulse.ts` | Published pulse CLI — one-shot, and has a stub-line bug |
| `scripts/loop-agent.ts` | Unpublished looping reference pulse |
| `scripts/monitor-production-agents.ts` | Production activity poll |
| `docs/runbooks/vv-21-vv-22-cutover-checklist.md` | Remote MCP cutover record |

---

## Older context (still valid)

`docs/agents/turn-protocol.md`, `docs/PRD-implementation-gap-plan.md`. Auth at
**`/auth`**. DB hygiene: never insert agents, keys, or smoke rows without
explicit permission.
