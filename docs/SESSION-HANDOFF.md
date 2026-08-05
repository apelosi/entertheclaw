# Session handoff — 2026-08-05 (VV-23: harness-driven wake in progress)

## Start new chat (paste this)

```
Continue Enter The Claw — VV-23 (durable agent wake).

Read docs/SESSION-HANDOFF.md, then Linear VV-23:
https://linear.app/vibezventures/issue/VV-23/durable-agent-wake-one-invite-paste-agent-performs-forever-any-runtime

SECURITY (operator closed 2026-08-05): OpenRouter key that ETC09 pasted was
rotated in onecli. ETC01/ETC09 `etc_live_…` keys were intentionally left as-is
(operator: exposure not dangerous). Do not write to prod without explicit
permission.

Shipped on branch (pending merge/publish): harness-driven capability ladder in
invite + /skill.md + MCP instructions; entertheclaw-pulse 0.6.0 stays
**one-shot by default** (NanoClaw gate requires exit), opt-in `LOOP=1` for
detached processes, fail-closed (no stub lines). Pulse/LLM keys are NOT in the
invite path.

Hermes validation SKIPPED (operator has no Hermes agent right now).

NanoClaw gate script decoded (host evidence): see "How the working NanoClaw
fleet actually stays alive" below. `ncl tasks get` prints full ETC_API_KEY in
the script field — never copy raw keys into repo/docs.

After merge: npm publish entertheclaw-mcp@0.6.0 from the Mac
(docs/runbooks/publish-entertheclaw-mcp.md). Do NOT change the one-shot default
or the fleet's `out=$(entertheclaw-pulse)` gate hangs.

Prod DB read-only: DATABASE_URL="$NEON_DATABASE_URL_PRODUCTION".
Follow AGENTS.md and ~/.cursor/skills/global-operating-standards/SKILL.md.
```

---

## Security

**Closed 2026-08-05 by operator:** OpenRouter key ETC09 pasted into chat was
rotated in onecli. ETC01/ETC09 Enter The Claw API keys (`etc_live_0964e1d••••` /
`etc_live_259142f••••`) were left unchanged — operator judged that exposure
not dangerous. Do not rotate them unless asked.

---

## The open problem (VV-23)

A fresh invite reliably produces **enroll → join → 1–2 lines → silence**. ETC is
pull-based: nothing on our side can wake an agent. Something in the agent's
runtime must wake it on a schedule.

**Approved direction (in code; Hermes validation skipped for now):**

1. Channel-paste path is **harness-driven** — runtime scheduler wakes the
   agent; agent uses its own model. No pulse / second LLM key in the invite.
2. Capability ladder in invite + skill + MCP instructions:
   (a) agent-creatable recurring task → (b) detached long-running process →
   (c) honest failure.
3. Optional: `entertheclaw-pulse` with opt-in `LOOP=1` + stub deleted — not in
   onboarding path. **Default remains one-shot** (NanoClaw gate needs exit).
4. NanoClaw = host `ncl tasks create` exception whose live topology is a
   script gate that runs pulse and **never** wakes the agent (`wakeAgent: false`).
5. Hermes validation deferred (no Hermes agent available).

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

**The `--script` gate is the whole trick.** It runs *before* any agent wake;
its last stdout line must be `{"wakeAgent": <bool>, …}`. It is also mandatory
for this cadence: recurrences above 4 fires/day are refused unless the task
carries a gate.

**Gate script body (host evidence, 2026-08-05)** —
`container/agent-runner/src/scripts/etc-pulse-run.sh` → `/app/src/scripts/…`:

1. Read `model` from `/workspace/agent/container.json` → `LLM_MODEL`
   (fallback `deepseek/deepseek-v4-flash`).
2. `LLM_API_KEY="${OPENROUTER_API_KEY:-}"` — credential from the group's
   OpenRouter key in onecli, **not** from the task script and **not** from
   waking the agent.
3. `ETC_STATE_PATH=/workspace/agent/.entertheclaw-state.json` so the event
   cursor survives container cycling.
4. Run baked-in `entertheclaw-pulse` (image pin `ENTERTHECLAW_MCP_VERSION`),
   capture stdout/stderr.
5. Pipe output to `etc-pulse-notify.mjs` for owner Slack (runtime-side; not
   platform).
6. **Always** `echo '{"wakeAgent": false}'` — routine pulses never wake the
   full agent harness. Zero agent tokens; model tokens only when pulse acts.

Related host files: `etc-pulse.sh`, `etc-pulse.mjs`, `etc-pulse-notify.mjs`,
`scripts/bootstrap-etc-pulse-tasks.ts`, `scripts/apply-etc-pulse-script.ts`.

**Implication for pulse packaging:** default must stay **one-shot**. The gate
does `out=$(entertheclaw-pulse 2>&1)` and must return. `LOOP=1` is opt-in for
detached Hermes/OpenClaw-style processes only.

**Stale task details still true:** prompt pins `entertheclaw-mcp@0.4.0`,
`ETC_API_URL=…/api/v1`. `ncl tasks get` prints full `ETC_API_KEY` in the
script field — never paste that into repo/docs/chat unnecessarily.

**ETC09 has neither half:** no task, and none of the scaffolding the others
carry (`heartbeat-loop.js`, `etc_credentials.md`, `etc_protocol.md`,
`instructions.prepend.md`, `.entertheclaw-state.json`). Those Jun-27 files are
pre-`etc-pulse-run.sh` leftovers and should not be cargo-culted into new groups.

**Containers are per-wake.** A detached background process cannot survive on
NanoClaw — the container ceases to exist between wakes. That is why the fleet
uses one-shot pulse inside the gate, not `LOOP=1`.

**Consequences.** `ncl tasks create` takes `--group` explicitly for host callers,
so onboarding a NanoClaw agent is one reproducible host command — the documented
exception. The better ask is for NanoClaw to let an agent create its own
script-gated task from inside the container. Channel-paste "harness-driven
wake the agent" does **not** describe this fleet — the fleet never wakes the
agent for routine pulses.

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
| `entertheclaw-pulse` one-shot default + `LOOP=1` + stub deleted | Done; needs `npm publish` 0.6.0 from Mac |
| Hermes validation (Lys Ardent) | **Skipped** — no Hermes agent right now |
| OpenRouter key (ETC09 paste) | Rotated in onecli (operator) |
| ETC01/ETC09 `etc_live_…` keys | Left as-is (operator: not dangerous) |
| `etc-pulse-run.sh` fact-find on VPS | **Done** — always `wakeAgent:false`; pulse + OPENROUTER_API_KEY |

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
| `mcp/src/pulse.ts` | Optional pulse CLI — default one-shot; `LOOP=1` for detached |
| `scripts/loop-agent.ts` | In-repo looping reference pulse |
| `scripts/monitor-production-agents.ts` | Production activity poll |
| `docs/runbooks/vv-21-vv-22-cutover-checklist.md` | Remote MCP cutover record |
| `decisions/2026-08-05-harness-driven-durable-wake.md` | VV-23 direction |

---

## Older context (still valid)

`docs/agents/turn-protocol.md`, `docs/PRD-implementation-gap-plan.md`. Auth at
**`/auth`**. DB hygiene: never insert agents, keys, or smoke rows without
explicit permission.
