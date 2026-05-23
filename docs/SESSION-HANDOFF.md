# Session handoff — 2026-05-23 (turn protocol shipped, push channel mid-design)

## Start new chat (paste this)

```
Continue Enter The Claw. Read docs/SESSION-HANDOFF.md, docs/agents/turn-protocol.md,
and decisions/2026-05-23-turn-protocol.md first. Phase 1 (pull-based turn protocol)
is shipped on dev (commit f157f49, pushed). Phase 2 push-channel design was open;
I now have a different idea for it — wait for me to share it before designing or
coding anything in that area. bun run dev → http://localhost:3000. Do not commit
unless I ask.
```

Also: `~/.cursor/skills/global-operating-standards/SKILL.md`

---

## User goal

Auth → enroll → autonomous agents on a stage → continuous live dialogue. Twists UI shipped. Multiple runtimes supported (NanoClaw / OpenClaw / Hermes / custom) via the turn protocol.

## Phase status

| Phase | Status |
| --- | --- |
| **0** | **PASS** — API smoke + E5/E6/E7; auth OAuth fix |
| **1** | **DONE & PUSHED** — claim/grant turn protocol (commit `f157f49` on `dev`). Extended heartbeat (`pulseHintMs`, `turnState`, `addressedToYou`, `unreadEvents`), agent SSE, `scripts/loop-agent.ts`, MCP `etc_claim_turn` + `etc_observe`, `docs/agents/turn-protocol.md`, `docs/agents/system-prompt-addendum.md`, `decisions/2026-05-23-turn-protocol.md` |
| **2** | **DESIGN PAUSED — user has a new idea.** Goal is dual-mode wakeups (push webhook + heartbeat). No code yet. Last conversation explored filtered push with per-agent `live` / `responsive` / `none` modes; user wants to revisit before any of this is built. **Do not start coding Phase 2 — wait for the user's new direction.** |
| **Verify (user-side)** | Paste `docs/agents/system-prompt-addendum.md` into the 4 Claw Wars NanoClaws, watch the stage page for autonomous progression. 30-min cadence will limit liveness — that's expected and is the motivation for Phase 2. |

## Phase 2 — context for whoever picks this up

**What's already decided / fixed:**

- Push and pull must coexist; webhook is opt-in per agent. Heartbeat stays as durable catch-up.
- Webhook delivery model: best-effort (no retry queue in v1). Heartbeat's `unreadEvents` cursor backfills any missed deliveries.
- Webhook payload mirrors the heartbeat response shape so the persona logic is push/pull-agnostic.

**What is still open (user wants to redesign):**

- Which event types push, and to whom (filtered vs firehose)
- Whether to ship multiple per-agent modes (`live` / `responsive` / `none`) or just one default
- How registration flows — generic webhook URL with HMAC vs something else
- Whether to layer a different mechanism entirely (the user said "I have a better idea")

**Do not start any of this until the user shares the new idea.** Re-reading the previous chat is unnecessary — the open question is just "what's the new idea, and what does it imply".

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

## Still open (unrelated to Phase 2)

- SSE poll fix in `app/api/v1/stages/[id]/events/route.ts`
- `/stages/[id]` alias → `/stage/[id]`
- Absence cron, Phaser v2
- Optional: redirect `/sign-in` → `/auth` for old links
- Pre-existing uncommitted edits in `components/stage/{active-twist,dialogue-history-modal,dialogue-panel,narrative-twist,twist-banner}.tsx` and `lib/stage/feed-items.ts` — not mine, left alone

## New chat discipline

Lean context: this file + `docs/agents/turn-protocol.md` + `decisions/2026-05-23-turn-protocol.md`. No extra MCPs unless needed. No commit without ask. **For Phase 2: wait for the user's new idea before designing anything — do not re-derive the previous webhook plan.**
