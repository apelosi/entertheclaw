# Session handoff — 2026-05-23 (turn_open snapshot done; push + live stage next)

## Start new chat (paste this)

```
Continue Enter The Claw. Read docs/SESSION-HANDOFF.md first, then
docs/agents/turn-protocol.md and decisions/2026-05-23-turn-open-snapshot.md.

User wants ALL open work moved forward — build, test, verify. Do not commit
unless I ask.

Context:
- Branch dev, large UNCOMMITTED diff (turn_open snapshot + related protocol work).
- Phase 1 emit model DONE locally: inline turn_open on dialogue/twist, 60s grant
  TTL, 60s safety-net re-ping, snapshot on turn_open, no turn_revoke, no join
  emit. Verify: bun run scripts/verify-turn-open-snapshot.ts (44 checks).
- bun run dev → http://localhost:3000

Execute in order (parallelize where safe):

A. Phase 2 push wakeups (priority — unblocks 30-min agents)
   - Webhook delivery for turn_open + turn_grant ONLY (no other event types).
   - Payload: turn_open carries full snapshot (build-turn-open-snapshot.ts);
     turn_grant carries grant metadata + expiresAt.
   - Per-agent webhook URL registration (schema + enroll/settings API).
   - Best-effort POST on emit; heartbeat/SSE remain catch-up.
   - Optional HMAC on outbound webhook body.

B. Post-grant history API (same phase, after or parallel to A)
   - GET .../context — current scene, active twist, characters, recent dialogue.
   - GET .../events?types=dialogue,scene_change,twist&since=<id|iso>&limit=N
   - Agent-authenticated; document in turn-protocol.md.

C. Live stage / viewer fixes (parallel with A/B)
   - Fix SSE poll bug: app/api/v1/stages/[id]/events/route.ts (lastEventId).
   - Route alias /stages/[id] → /stage/[id].
   - No `/sign-in` or `/sign-up` app routes (canonical `/auth` only).

D. Hygiene
   - Scene classifier X-Title em-dash → hyphen (done if already in diff).
   - Update docs/PRD-implementation-gap-plan.md Phase 1 notes (60s grant, snapshot).
   - Re-run verify-turn-open-snapshot.ts after any emit-path changes.

Gate before calling Phase 2 done: webhook receives turn_open within seconds of
dialogue POST; optional history GET works; SSE viewer shows new dialogue without
refresh; verify script still passes.

Follow ~/.cursor/skills/global-operating-standards/SKILL.md.
```

Also: `~/.cursor/skills/global-operating-standards/SKILL.md`

---

## User goal

Auth → enroll → autonomous agents on a stage → continuous live dialogue. Twists UI shipped. Multiple runtimes supported (NanoClaw / OpenClaw / Hermes / custom) via the turn protocol.

## Phase status

| Phase | Status |
| --- | --- |
| **0** | **PASS** — API smoke + E5/E6/E7; auth OAuth fix |
| **1** | **DONE (local, uncommitted)** — claim/grant protocol, 60s grant TTL, `turn_open` snapshot on dialogue/twist, 60s safety-net re-ping, no `turn_revoke`, no join emit, no 6s quiet timer. Verify: `bun run scripts/verify-turn-open-snapshot.ts` (44 checks). |
| **2** | **READY TO BUILD** — push webhooks (`turn_open` + `turn_grant`), optional history GET APIs, SSE poll fix, route aliases. User greenlit all open work. |
| **Verify (user-side)** | Paste `docs/agents/system-prompt-addendum.md` into NanoClaws; OAuth in external browser. |

## Phase 2 — agreed shape (build next)

- Push: `turn_open` (with snapshot) + `turn_grant` only.
- Inline `turn_open` on every successful dialogue POST (already shipped).
- 60 s re-ping via cron if no dialogue after last `turn_open` or `turn_grant`.
- Optional `GET` history endpoints for post-grant depth (build in 2B).
- Webhook: best-effort, per-agent URL, heartbeat backfill for misses.

## Uncommitted work summary (dev branch)

**Protocol / turn_open (this session):**
- `lib/stage/build-turn-open-snapshot.ts`, `lib/stage/emit-turn-open.ts`
- Wired: dialogue, twist, cron safety-net; join does NOT emit
- `lib/stage/turn-state.ts` (60s grant, no SCENE_QUIET)
- `scripts/verify-turn-open-snapshot.ts`, `decisions/2026-05-23-turn-open-snapshot.md`
- Docs: turn-protocol.md, system-prompt-addendum.md, SESSION-HANDOFF.md

**Also in diff (review before commit):** agent/community pages, profile queries,
scene-classifier hyphen fix, migration 0007 (turn_revoke removed from enum).

## Environment

- `bun run dev` → **http://localhost:3000** (one process only; `lsof -tiTCP:3000,3001 | xargs kill` before restart)
- `.env.local`: `DATABASE_URL`, `NEON_AUTH_*`, `RECRAFT_API_KEY`
- OAuth: **Neon console** (not `.env.local`)
- Repo on **iCloud Drive** — can break `.next` → `rm -rf .next && bun run dev` + hard refresh if `ChunkLoadError` / `app/page.js` 404
- Branch **`dev`**, **large uncommitted diff** — do not commit unless user asks

## Auth (current routes — important)

| Old | Now |
| --- | --- |
| `/sign-in`, `/sign-up` | **`/auth`** unified page (`app/auth/page.tsx`, `app/auth/auth-form.tsx`) |
| — | `lib/auth/paths.ts` — `AUTH_PATH`, `authUrl(callbackUrl)` |
| OAuth callback | **`/auth/callback`** (`app/auth/callback/page.tsx`) |
| Social OAuth | `lib/auth/start-social-sign-in.ts` — full-page redirect (`disableRedirect: true`) |
| Email OTP | `lib/auth/email-otp.ts` (sign-in code flow in auth form) |
| Nav CTA | **"Sign in / up"** → `/auth` |

Protected routes redirect via `authUrl()` (e.g. invite → `/auth?callbackUrl=...`).

**GitHub OAuth:** Neon iframe popup fails in Cursor embedded browser; `startSocialSignIn` fixes full-page flow. Test in external browser when possible.

## Phase 0 — API (done)

| ID | Fix | File |
| --- | --- | --- |
| E5 | One stage per agent (409 on second join) | `app/api/v1/stages/[id]/join/route.ts` |
| E6 | `characters` stub on join + `characterId` | same |
| E7 | `POST .../emote` | `app/api/v1/stages/[id]/emote/route.ts` |

**Smoke:** `SMOKE_BOOTSTRAP=1 ./scripts/smoke-agent.sh` or `ETC_API_KEY=...` — see `docs/runbooks/agent-api-smoke.md` (**PASS**).

## Phase 0 — Auth / UX (done + verify)

- Runbooks: `docs/runbooks/auth-smoke.md`, `docs/runbooks/agent-api-smoke.md`
- Stage images: `public/stages/*.webp`, `bun run db:refresh-images`
- `EnrollAgentLink`, invite page protected, uses `/auth` redirect

**User should verify:** full GitHub/Google OAuth in Chrome/Safari after hard refresh.

## Dev troubleshooting

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
curl -I http://localhost:3000/_next/static/chunks/app/page.js   # expect 200
rm -rf .next && bun run dev   # if ChunkLoadError
```

## Enroll flow

```
/auth (Neon session)
  → POST /api/v1/agents/keys (cookies) → etc_live_* once
  → POST /api/v1/agents (Bearer) { name, agentType }
  → POST /api/v1/stages/:id/join
  → heartbeat / dialogue / emote
```

## Key files

| Path | Purpose |
| --- | --- |
| `docs/PRD-implementation-gap-plan.md` | Master plan |
| `docs/SESSION-HANDOFF.md` | This file |
| `scripts/smoke-agent.sh` | API gate |
| `app/auth/auth-form.tsx` | Sign in/up UI |
| `lib/auth/start-social-sign-in.ts` | OAuth redirect |
| `lib/auth/paths.ts` | `/auth` helpers |
| `app/api/v1/stages/[id]/join/route.ts` | E5/E6 |
| `app/api/v1/stages/[id]/emote/route.ts` | E7 |
| `components/stage/stage-canvas.tsx` | Live view + SSE dialogue |

## Still open (after Phase 2)

- Absence cron (6h/24h), Phaser v2 — later phases
- Pre-existing twist UI component edits in `components/stage/*` — review separately

## New chat discipline

Lean context: this file + turn-protocol.md + turn-open-snapshot decision. User greenlit all open work — proceed without re-asking design questions already captured above. No commit without ask.
