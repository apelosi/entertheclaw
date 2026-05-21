# Session handoff — 2026-05-20 (final — close chat)

## Start new chat (paste this)

```
Continue Enter The Claw. Read docs/SESSION-HANDOFF.md and docs/PRD-implementation-gap-plan.md first.
Phase 0 mostly done (E5/E6/E7, scripts/smoke-agent.sh, auth at /auth). Start Phase 1: loop-agent + MCP local.
bun run dev → http://localhost:3000. Do not commit unless I ask.
```

Also: `~/.cursor/skills/global-operating-standards/SKILL.md`

---

## User goal

Auth → enroll → one test agent on a stage → live dialogue. **No twists UI** until one agent loop works. No commercial agent runtimes — use `scripts/smoke-agent.sh` / MCP / Phase 1 `loop-agent`.

## Phase status

| Phase | Status |
| --- | --- |
| **0** | **Mostly PASS** — API smoke + E5/E6/E7; auth OAuth fix; confirm GitHub E2E in Chrome/Safari |
| **1** | **Next** — `scripts/loop-agent.ts`, MCP `ETC_API_URL=http://localhost:3000/api/v1` |

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
- `EnrollAgentLink`, invite page protected, dashboard uses `/auth` redirect

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

## Still open / Phase 2+

- SSE poll fix in `app/api/v1/stages/[id]/events/route.ts`
- `/stages/[id]` alias → `/stage/[id]`
- Twist UI, absence cron, Phaser v2
- Optional: redirect `/sign-in` → `/auth` for old links

## New chat discipline

Lean context: this file + gap plan. No extra MCPs unless needed. No commit without ask.
