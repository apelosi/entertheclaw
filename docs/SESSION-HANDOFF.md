# Session handoff — 2026-08-05 (remote MCP shipped; durable wake is the open problem)

## Start new chat (paste this)

```
Continue Enter The Claw — now working VV-23 (durable agent wake).

Read docs/SESSION-HANDOFF.md, then Linear VV-23:
https://linear.app/vibezventures/issue/VV-23/durable-agent-wake-one-invite-paste-agent-performs-forever-any-runtime

Context: VV-21 (hosted remote MCP at {origin}/mcp) and VV-22 (thin invites, no
package versions, unversioned API_BASE={origin}/api) are DONE and merged.
PR #120 (docs only, decision records) may still be open.

THE GOAL, which overrides everything: an owner pastes ONE invite into the
channel they already use to talk to their agent (Slack/WhatsApp/Telegram) and
that agent performs on stage FOREVER. No second message, no dashboard step, no
VPS/host access, no per-runtime hand-holding. Must work for NanoClaw, Hermes,
OpenClaw, etc. — not just the one we test with. Never propose host cron, VPS
Claude Code prompts, or ETC posting into the owner's channel; all three were
evaluated and rejected (see decisions/2026-08-05-channel-only-forever-onboarding.md).

Approved work for this session:
1. Ship loop mode in the published pulse CLI. mcp/src/pulse.ts is one-shot —
   it computes the next sleep interval then exits. The looping implementation
   already exists unpublished in scripts/loop-agent.ts (while(true), adaptive
   sleep on directive.retryAfterMs / nextPulseSuggestionMs, LOOP_ONCE=1 to opt
   out). Port it so one detached process self-perpetuates.
2. Rewrite the invite (lib/agents/invite-message.ts) + /skill.md
   (lib/agents/participation-prompt.ts) + MCP server instructions
   (lib/mcp/instructions.ts) around a capability ladder:
   (a) runtime's own agent-settable recurring task, (b) else detached pulse
   loop, (c) else report honestly that setup cannot complete.
3. Solve how the pulse gets a model API key from a single paste.

Known limits to respect: NanoClaw ETC9's group blocks every in-container
scheduler and uses recycled stateless containers, so it likely will NOT be
fixed by this. Validate on Hermes first (Zain's agent Lys Ardent /
Jorath Vensir, agent dbfba74c-38e4-49c0-a9a2-282bffde9633, stage Claw Wars).

Prod DB for read-only checks: DATABASE_URL="$NEON_DATABASE_URL_PRODUCTION".
Never write to prod without explicit permission. Follow AGENTS.md and
~/.cursor/skills/global-operating-standards/SKILL.md.
```

---

## The open problem (VV-23)

A fresh invite reliably produces **enroll → join → 1–2 lines → silence**. ETC is
pull-based: nothing on our side can wake an agent, and
`POST /stages/:id/heartbeat` is the agent calling us, not a timer we control. So
the agent must create its own durable recurring wake — and most runtimes either
forbid that or were never told to.

**Evidence (2026-08-05, production):**

- **NanoClaw ETC9** — enrolled 12:24 UTC, last heartbeat 12:30 UTC. Two clean
  claim → grant → dialogue cycles over hosted remote MCP, then nothing. The
  stage kept going without it (81+ lines from others in the same window).
- **Lys Ardent** (Zain's Hermes agent) — identical failure months earlier,
  silent 12+ days. No amount of owner email could have fixed it.
- **The 13 survivors** — all `agent_type=nanoclaw`, zero webhooks, heartbeats
  under 3 minutes old. They live only because the operator created NanoClaw
  **host platform recurring tasks** outside the agent chat during setup
  (e.g. `task-1782560909602-3khcji`, every 3 min → `/workspace/agent/heartbeat-check.sh`
  → `heartbeat-loop.js`). No agent created its own.

**ETC9 exhausted every in-container path:** `CronCreate` and `ScheduleWakeup` in
`SDK_DISALLOWED_TOOLS`, `ncl tasks` CLI forbidden for the group, `RemoteTrigger`
unimplemented, `inbound.db` read-only, no MCP servers addable without admin.

**Our contributing bug:** the published `entertheclaw-pulse` (`mcp/src/pulse.ts`)
is one-shot — it runs `pulseOnce()`, computes the next sleep, then exits. It
structurally requires the scheduler agents cannot create. The looping version
has existed the whole time, unpublished, in `scripts/loop-agent.ts`.

### Rejected — do not revisit without new information

| Approach | Why rejected |
|---|---|
| Stronger invite wording | Tried twice (PR #118, #119). Cannot create capability a runtime forbids. |
| Owner installs host cron / runs Claude Code on the VPS | Violates the single-paste requirement; does not scale past our own fleet. |
| ETC pushes wake messages into the owner's channel | Per-workspace OAuth/token setup, constant message noise, a new integration per harness. |
| Agent claims `/loop` scheduled it | ETC9 did exactly this; nothing persisted. |

Rationale: `decisions/2026-08-05-channel-only-forever-onboarding.md`.

---

## Shipped 2026-08-05 (VV-21 + VV-22)

- **Hosted remote MCP** at `{origin}/mcp` (`app/mcp/route.ts`, `lib/mcp/*`),
  Streamable HTTP / MCP 2026-07-28, Bearer `etc_live_…`. Origin-relative, so
  localhost / preview / prod each serve their own — never a hardcoded host.
- **Local stdio retired.** `npx entertheclaw-mcp` as an MCP server is gone and
  deprecated on npm; the package now ships the `entertheclaw-pulse` bin only.
- **No versions in agent-facing copy** — no `entertheclaw-mcp@X.Y.Z`, no
  `@latest`, no `/api/vN`. `mcp/package.json` version is publish metadata only.
- **Unversioned API base.** Agents get `API_BASE = {origin}/api`; Next rewrites
  in `next.config.ts` map `/api/{agents,stages,characters,twists,…}` to the
  current `/api/v1` implementation. Never put `/api/vN` in an invite again.
- **Thin invite** (~6.8KB → ~1.4KB): credentials + MCP block + pointer to
  `/skill.md`. Protocol lives in `/skill.md` and MCP server instructions, both
  updated by deploy — no re-inviting for routine changes.
- **Fleet migrated** off stdio (ETC01 confirmed); Zain emailed for Hermes.

---

## Ops lessons (read before writing handoff instructions)

### Where to run commands

| Task | Where | NOT |
|------|-------|-----|
| Agent coding, PRs, tests | Cursor cloud VM / agent | — |
| **`npm publish` (entertheclaw-mcp)** | **Your Mac** after `git pull origin main` | Cloud VM (no npm auth) |
| Netlify production deploy | Automatic on merge to `main` | Manual unless debugging |
| NanoClaw fleet wake / host config | VPS NanoClaw project | entertheclaw repo |

**Always lead instructions with WHERE.**

### Talking to the user

- Give full PR URLs — `PR #61` may not be clickable.
- Copy-paste blocks for another agent go in a **single** fenced code block (no
  nested fences) so the copy button works.
- Never put a package version or `/api/vN` in anything an agent will read.
- Owner emails (`bun run notify-owners`) require the user to review the full
  body before `--send`. Dry-run is the default; `--send` without approval is a
  standing violation.

### npm publish

Canonical runbook: [`docs/runbooks/publish-entertheclaw-mcp.md`](./runbooks/publish-entertheclaw-mcp.md)

- Package `entertheclaw-mcp`, maintainer `apelosi`; now **pulse CLI only**
- **WHERE:** your Mac after `git pull` (cloud VMs have no npm auth)
- Skip `npm login` / `npm whoami` — go dry-run → `npm publish` (auth + the
  5-minute checkbox happen on publish)
- `ENEEDAUTH` = auth failed or publish session expired; `E404` = wrong account

### Production monitoring

```bash
bun scripts/monitor-production-agents.ts
```

Read-only DB check: `DATABASE_URL="$NEON_DATABASE_URL_PRODUCTION"` (host
`ep-muddy-wave…`). Dev is `ep-polished-paper…`. Never write to prod without
explicit permission.

Stages with agents: Claw of the Titans, Claw Wars, The Clawfather.

### Fleet wake pitfall

"Wake all agents" often means only *some* containers/tasks actually run.
Symptom: one stage live, others silent for days with `since_heartbeat` matching
the pause. Check per-container that the task is enabled and reaches heartbeat.

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
| `mcp/src/pulse.ts` | Published pulse CLI — **one-shot; VV-23 makes it loop** |
| `scripts/loop-agent.ts` | Unpublished looping reference pulse |
| `scripts/monitor-production-agents.ts` | Production activity poll |
| `docs/runbooks/agent-stage-continuity.md` | Stale stage / wake runbook |
| `docs/runbooks/vv-21-vv-22-cutover-checklist.md` | Remote MCP cutover record |

---

## Older context (still valid)

`docs/agents/turn-protocol.md`, `docs/PRD-implementation-gap-plan.md`. Auth at
**`/auth`**. DB hygiene: never insert agents, keys, or smoke rows without
explicit permission.
