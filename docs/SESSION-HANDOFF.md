# Session handoff — 2026-07-11 (NanoClaw token cost + fleet wake)

## Start new chat (paste this)

```
Continue Enter The Claw. Read docs/SESSION-HANDOFF.md first.

Recent work (merged + shipped):
- PR #61: trim directive.prompt (E2), slim MCP act=true payload (E1), skill.md
  stateless contract (E3), vitest size tests (E4). Merged to main.
- entertheclaw-mcp@0.3.1 published to npm (owner: apelosi).
- NanoClaw VPS: AGREED split with ETC — N8 direct-REST speak path (not Claude
  Code on pulses). Fleet mostly recovered.

Production status (~2026-07-11):
- 13/14 agents heartbeating; all 3 stages active (~64 lines/hour fleet-wide).
- Only gap: Lys Arden / Jorath Vensir on Claw Wars (DOWN ~9d). Owner Zain
  emailed separately with wake instructions (another chat).

Monitor: bun scripts/monitor-production-agents.ts (polls entertheclaw.com).

Follow ~/.cursor/skills/global-operating-standards/SKILL.md.
```

---

## NanoClaw ↔ ETC agreement (2026-07-10)

**Root cause of ~35k tokens/wake:** NOT `directive.prompt` alone (~3k chars).
Main cost was Claude Code system + tool schemas (~25–29k) plus multi-call tool
loops within one wake.

**Fix split:**
| Side | Owns |
|------|------|
| **NanoClaw** | **N8** — REST heartbeat → gate → claim → **one** OpenRouter call with **only** `directive.prompt` → REST dialogue. No MCP tool loop on scheduled pulses. Claude Code = admin only. |
| **ETC** | E2 trim `build-directive.ts`, E1 slim MCP 0.3.1, E3 skill.md, E4 tests |

**Success criteria:** `act=false` = 0 model tokens; N8 `act=true` <2k typical,
<5k ceiling to resume fleet.

Reference runtime: `scripts/loop-agent.ts` (single user message, no system).

---

## ETC changes shipped (PR #61)

- `lib/stage/build-directive.ts` — structured prompt, backstory hook ~120 chars,
  memory cap ~1200 chars in prompt, `linesSinceLastSpoke` max 12, shorter closing
  instruction.
- `mcp` 0.3.1 — `etc_heartbeat` act=true returns only
  `{ session, directive, haveFloor, latestEventId }` (no duplicate context).
- `/skill.md` — "Stateless agent contract" + send ONLY `directive.prompt`.
- `scripts/monitor-production-agents.ts` — production poll (no auth).

---

## Ops lessons (read before handoff instructions)

### Where to run commands

| Task | Where | NOT |
|------|-------|-----|
| Agent coding, PRs, tests | Cursor cloud VM / agent | — |
| **`npm publish` (entertheclaw-mcp)** | **Your Mac** after `git pull origin main` | Cloud VM (no npm auth) |
| Netlify production deploy | Automatic on merge to `main` | Manual unless debugging |
| NanoClaw N8 / fleet wake | VPS NanoClaw project | entertheclaw repo |

**Always lead instructions with WHERE.** Before publish: `git checkout main &&
git pull` on Mac, confirm `mcp/package.json` version, then `cd mcp && bun run
build && npm publish`.

### PR / links for user

Plain `PR #61` may not be clickable in chat. Always give full URL:
https://github.com/apelosi/entertheclaw/pull/61

For copy-paste blocks to another agent, use a **single** fenced code block (no
nested fences) so the copy button works.

### npm publish

- Package: `entertheclaw-mcp`, maintainer `apelosi`
- `npm publish --dry-run` works without login; real publish needs `npm login`
- ENEEDAUTH = not logged in; E404 on publish = wrong account / no permission

### Production monitoring

```bash
bun scripts/monitor-production-agents.ts
```

Public API: `https://entertheclaw.com/api/v1/stages` + per-stage feed.
Stages with agents (Jul 2026): Claw of the Titans, Claw Wars, The Clawfather.

### Fleet wake pitfall

"Wake all agents" can mean only **some** containers/tasks actually run. Symptom:
one stage live (Titans), others silent 2+ days with `since_heartbeat` matching
fleet pause time. Fix per-container: task enabled, N8 script reaches heartbeat,
`ETC_API_URL=https://entertheclaw.com/api/v1`.

---

## Key files

| Path | Purpose |
|------|---------|
| `lib/stage/build-directive.ts` | Server-side directive.prompt |
| `lib/agents/participation-prompt.ts` | `/skill.md` source |
| `scripts/loop-agent.ts` | Reference N8 pulse (stateless) |
| `scripts/monitor-production-agents.ts` | Production activity poll |
| `mcp/` | entertheclaw-mcp npm package (0.3.1) |
| `docs/runbooks/agent-stage-continuity.md` | Stale stage / wake runbook |

---

## Older context (turn protocol — still valid)

See `docs/agents/turn-protocol.md`, `docs/PRD-implementation-gap-plan.md`.
Phase 0 mostly done; Phase 1 (`loop-agent`, local MCP) ongoing.

Auth at **`/auth`**. DB hygiene: never insert agents/keys without explicit
permission. Production agents EC1–EC20 use `https://entertheclaw.com/api/v1`.
