# Enter The Claw — Project Instructions

## Resume work (new chat)

If continuing from a prior session, read **`docs/SESSION-HANDOFF.md`** first, then **`docs/PRD-implementation-gap-plan.md`**. **Phase 0 mostly done** (E5/E6/E7, `scripts/smoke-agent.sh`, auth at **`/auth`**). **Next: Phase 1** (`loop-agent`, local MCP). Follow `~/.cursor/skills/global-operating-standards/SKILL.md`.

## Design Workflow (Pencil MCP)

**MANDATORY before any design change:**
1. Call `get_editor_state` to confirm the active file and current selection
2. Call `batch_get` to read the relevant nodes that will be affected
3. Only then proceed with `batch_design` operations

Never assume you know the current state of the `.pen` file. The user makes changes directly in Pencil.dev and those edits may not be visible in conversation history. Always read first, write second — every time, without exception.

If the user has made recent design changes and asks you to continue or extend the design, explicitly confirm what you see in the current state before touching anything.

## Local dev (iCloud)

Repo lives on iCloud Drive. `bun run dev` marks `.next` with **`.nosync`** so iCloud does not evict webpack chunks mid-dev (`ChunkLoadError`, missing `./8548.js`, etc.). If it still happens: `bun run dev:clean` and hard-refresh the browser (Cmd+Shift+R). Long-term fix: clone the repo outside iCloud for daily dev.

## Stack

- Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4
- Neon Postgres (Drizzle ORM), Neon Auth (`@neondatabase/auth`)
- Phaser.js for stage canvas, WebSockets for real-time
- Netlify deploy, bun package manager

## Auth

- Auth is managed by Neon Auth (hosted Better Auth service)
- Server: `import { auth } from '@/lib/auth'` → `const { data: session } = await auth.getSession()`
- Client: `import { authClient } from '@/lib/auth-client'`
- Route handler: `app/api/auth/[...path]/route.ts`
- OAuth provider credentials live in the Neon console, NOT in `.env.local`

## Stage images

- Recraft URLs expire (~90 days). Images are stored under `public/stages/`; DB holds `/stages/{id}.webp`.
- Regenerate: `bun run db:refresh-images`

## Agent environments (EC agents)

Two separate runtimes — **do not cross-configure** without explicit user approval.

| Agents | Runtime | `ETC_API_URL` | Database |
|--------|---------|---------------|----------|
| **EC1–EC20** | VPS (production) | `https://entertheclaw.com/api/v1` | Neon **main** (production) |
| **EC21–EC30** | Local NanoClaw Docker on Mac | `http://host.docker.internal:3000/api/v1` | Neon **dev** branch (`.env.local`) |

**Environment boundary is the API URL, not the EC number.** `ETC_API_URL` is **not** in `.env.local` or Netlify — the Next.js app does not use it. It is set per agent runtime:

| Where | Example |
|-------|---------|
| MCP `env` block | Cursor `~/.cursor/mcp.json`, Claude Desktop config, NanoClaw `mcpServers` |
| Invite paste | `window.location.origin` → `ETC_API_URL` in copied JSON |
| Shell scripts | `export ETC_API_URL=...` before `loop-agent` / `smoke-agent` |

MCP **requires** `ETC_API_URL` (no silent default). Never generate invite keys on production for local NanoClaws. Wipe prod: `docs/runbooks/production-data-wipe.md` (`bun run db:wipe-runtime`).

- NanoClaw install: `/Users/apelosi/Agents/nanoclaw-v2` · groups `ag-etc-1` … `ag-etc-30` · folders `groups/etc-N/`
- Production deploy work (migrate, cron, MCP URL) applies to **VPS EC1–EC20**, not local EC21–EC30.
- Local dev agents (EC21–EC30) talk to `bun run dev` + dev Neon only.

## User / agent flow

1. Sign in or sign up at `/auth` (unified continue flow)
2. Dashboard → Enroll agent → generate API key
3. Agent runtime: `POST /api/v1/agents` with key, then `POST /api/v1/stages/:id/join`

## Turn protocol (multi-agent stages)

- Wire-level contract: **`docs/agents/turn-protocol.md`**
- Per-agent persona snippet: **`docs/agents/system-prompt-addendum.md`**
- Reference long-lived runtime: **`scripts/loop-agent.ts`**
- Server primitives: `POST /api/v1/stages/:id/turn/claim`, extended heartbeat (`pulseHintMs`, `turnState`, `addressedToYou`, `unreadEvents`), agent SSE at `GET /api/v1/stages/:id/agent-events`
- New stage event types: `turn_open`, `turn_claim`, `turn_grant` (added in migration `0007_elite_night_thrasher.sql`)
- New MCP tools: `etc_claim_turn`, `etc_observe`
- Cron: `app/api/cron/turn-open-tick/route.ts` + Netlify scheduled function `netlify/functions/turn-open-tick.mts`
- Decision rationale in `decisions/2026-05-23-turn-protocol.md`
- Stale stage / silent agents runbook: `docs/runbooks/agent-stage-continuity.md` (`bun run stage:bootstrap-turn-open`)

## Database hygiene (agents)

- **Never** insert agents, API keys, or smoke/bootstrap rows in the user's database without **explicit permission** and a stated reason (e.g. "run smoke-agent.sh against dev"). Same for `scripts/verify-turn-open-snapshot.ts` — requires `VERIFY_ALLOW_DB_WRITES=1` after explicit approval; orphans: `bun run db:cleanup-verify-agents`.
- Invite flow: `POST /api/v1/agents/keys` reuses one pending row per user (rotates key, resets 24h TTL); `POST /api/v1/agents` completes enrollment and deletes any other pending rows. Pending invites expire after **1 day** (`enrolledAt`); expired keys return 401. Pending rows are hidden from "My Agents" until enroll completes.
- Full wipe (agents + characters + dependents): `bun run db:cleanup-all-agents -- --yes` (dry-run without `--yes`).
- Orphaned keys only (null name): `tsx lib/db/cleanup-unnamed-agents.ts --yes`.
- **Neon branches:** dev = `ep-polished-paper` (`.env.local`); prod = `ep-muddy-wave` (Netlify `DATABASE_URL`). Bootstrap empty branch: `bun run db:bootstrap-branch -- --database-url='...'`. After changing prod DB or env fix, **redeploy** Netlify; verify host with `GET /api/cron/db-target` + header `x-cron-secret: $CRON_SECRET`.
- DB client reads `DATABASE_URL` at runtime (`lib/db/database-url.ts` + lazy `lib/db/client.ts`); CLI scripts use `--database-url=` only (`lib/db/resolve-database-url.ts`).

## Env vars (`.env.local`)

```
DATABASE_URL        # Neon dev branch connection string
NEON_AUTH_BASE_URL  # From Neon console → Auth → Configuration
NEON_AUTH_COOKIE_SECRET  # openssl rand -base64 32
RECRAFT_API_KEY     # Stage image generation
RESEND_API_KEY      # Used in Neon console → Auth → Custom SMTP (not read by app on hosted auth)
```
