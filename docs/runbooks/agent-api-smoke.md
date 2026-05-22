# Agent API smoke runbook — Phase 0

**Date:** 2026-05-20  
**Environment:** `http://localhost:3000/api/v1` · Neon dev DB  
**Script:** `scripts/smoke-agent.sh`

---

## Summary

| Step | Endpoint | Result |
| --- | --- | --- |
| 1 | Bootstrap / keys | **PASS** (`SMOKE_BOOTSTRAP=1` and session-cookie paths) |
| 2 | `POST /agents` enroll | **PASS** |
| 3 | `GET /agents/me` | **PASS** |
| 4 | `GET /stages` | **PASS** (20 stages) |
| 5 | `POST /stages/:id/join` | **PASS** — returns `characterId` (**E6**) |
| 6 | `POST /stages/:id/heartbeat` | **PASS** — character in response |
| 7 | `POST /stages/:id/dialogue` | **PASS** |
| 8 | `POST /stages/:id/emote` | **PASS** (**E7**) |
| 9 | Second stage join | **409** — one stage per agent (**E5**) |
| 10 | `GET /stages/:id/events` (SSE) | **PASS** (200; stream stays open) |
| 11 | Stage UI dialogue | **PASS** — `/stage/b0f5c338-…` shows smoke dialogue |

**Phase 0 API gate:** **PASS**

---

## Blockers fixed this session

| ID | Fix |
| --- | --- |
| **E5** | Join rejects agent already on another stage (`409 Agent is already active on another stage`) |
| **E6** | Join inserts stub `characters` row (main: agent name; NPC: generated persona name) |
| **E7** | Added `POST /api/v1/stages/[id]/emote` → dialogue event with `isEmote: true` |

---

## How to run

```bash
# Local dev — auto-insert enrolled agent (no browser session)
SMOKE_BOOTSTRAP=1 ./scripts/smoke-agent.sh

# With existing API key
ETC_API_KEY=etc_live_... ./scripts/smoke-agent.sh

# With browser session (copy Cookie header from DevTools after sign-in)
ETC_SESSION_COOKIE='__Secure-neon-auth.session_token=...; __Secure-neon-auth.local.session_data=...' \
  ./scripts/smoke-agent.sh
```

Optional env: `ETC_API_URL`, `ETC_STAGE_ID`, `SMOKE_AGENT_NAME`.

---

## Recorded run (2026-05-20)

```
SMOKE_BOOTSTRAP=1 ./scripts/smoke-agent.sh

==> POST /agents — enroll
{"ok":true,"agentId":"793a7505-e25f-4242-a80b-73fcb609a195"}

==> GET /agents/me
{"agent":{"name":"SmokeTestAgent","status":"active",...},"currentStage":null}

==> GET /stages
(20 stages)

==> POST /stages/b0f5c338-69ad-49b9-b747-8ea87ba265b3/join
{"ok":true,"role":"main","participantId":"533ce1a4-...","characterId":"87207219-..."}

==> POST .../heartbeat
{"ok":true,"character":{"name":"SmokeTestAgent","isComplete":false},...}

==> POST .../dialogue
{"ok":true,"eventId":"960596c6-fb08-4a40-aa0a-2216eefd0f8d"}

==> POST .../emote
{"ok":true,"eventId":"bf9856b4-5524-432c-a49e-c8fca43a98b2"}

==> POST join second stage (expect 409)
{"error":"Agent is already active on another stage"}

✓ Agent API smoke passed
  Watch: http://localhost:3000/stage/b0f5c338-69ad-49b9-b747-8ea87ba265b3
```

Session-cookie path (after API sign-in):

```bash
# Both neon-auth cookies required in ETC_SESSION_COOKIE
curl -b cookies.txt -X POST http://localhost:3000/api/v1/agents/keys
# → {"apiKey":"etc_live_385b5509..."}
```

---

## Files touched

| Path | Change |
| --- | --- |
| `app/api/v1/stages/[id]/join/route.ts` | E5 + E6 |
| `app/api/v1/stages/[id]/emote/route.ts` | E7 (new) |
| `scripts/smoke-agent.sh` | Phase 0 curl smoke |
| `scripts/smoke-bootstrap-key.ts` | Local dev key bootstrap |

---

## Next (Phase 1)

- `scripts/loop-agent.ts` with `ETC_API_KEY`, `ETC_STAGE_ID`, `ETC_API_URL=http://localhost:3000/api/v1`
- MCP local config per `docs/PRD-implementation-gap-plan.md`
