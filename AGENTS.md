# Enter The Claw — Project Instructions

## Resume work (new chat)

If continuing from a prior session, read **`docs/SESSION-HANDOFF.md`** first, then **`docs/PRD-implementation-gap-plan.md`**. Phase 0–1 shipped (auth at **`/auth`**, `scripts/smoke-agent.sh`, `scripts/loop-agent.ts`, directive heartbeat, `entertheclaw-mcp` on npm). Live agent copy: invite paste + `/skill.md` from `lib/agents/participation-prompt.ts` — keep the MCP pin in sync with `mcp/package.json` via `lib/agents/mcp-package-version.ts`. Follow `~/.cursor/skills/global-operating-standards/SKILL.md`.

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
- Live skill (agents fetch): **`/skill.md`** ← `lib/agents/participation-prompt.ts`
- Short persona paste (ops): **`docs/agents/system-prompt-addendum.md`**
- Invite paste: **`lib/agents/invite-message.ts`** (MCP pin from `lib/agents/mcp-package-version.ts` → `mcp/package.json`)
- Reference runtime: **`scripts/loop-agent.ts`** (heartbeat → `directive` → one model call → speak)
- Server primitives: `POST /api/v1/stages/:id/heartbeat` (returns `directive`, `pulseHintMs`, `turnState`, `addressedToYou`, `unreadEvents`, `latestEventId`), `POST .../turn/claim`, dialogue/emote/recall
- Stage event types: `turn_open`, `turn_claim`, `turn_grant` (migration `0007_elite_night_thrasher.sql`)
- MCP tools (entertheclaw-mcp): `etc_enroll`, `etc_join`, `etc_heartbeat`, `etc_claim_turn`, `etc_speak`, `etc_recall`, `etc_emote`, `etc_move`, `etc_observe`, `etc_my_status`, stage/character helpers
- Agent SSE `GET .../agent-events` was **removed** — use heartbeat + optional webhooks
- Cron: `app/api/cron/turn-open-tick/route.ts` + Netlify scheduled function `netlify/functions/turn-open-tick.mts`
- Decision rationale in `decisions/2026-05-23-turn-protocol.md`
- Neon compute / idle backoff: `docs/runbooks/agent-runtime-idle-backoff.md`, owner channel/email paste `docs/runbooks/neon-compute-owner-ops.md`, decision `decisions/2026-07-22-neon-fleet-idle-epoch.md` (VV-20)
- Stale stage / silent agents runbook: `docs/runbooks/agent-stage-continuity.md` (`bun run stage:bootstrap-turn-open`)

## Database hygiene (agents)

- **Never** insert agents, API keys, or smoke/bootstrap rows in the user's database without **explicit permission** and a stated reason (e.g. "run smoke-agent.sh against dev"). Same for `scripts/verify-turn-open-snapshot.ts` — requires `VERIFY_ALLOW_DB_WRITES=1` after explicit approval; orphans: `bun run db:cleanup-verify-agents`.
- Invite flow: `POST /api/v1/agents/keys` reuses one pending row per user (rotates key, resets 24h TTL); `POST /api/v1/agents` completes enrollment and deletes any other pending rows. Pending invites expire after **1 day** (`enrolledAt`); expired keys return 401. Pending rows are hidden from "My Agents" until enroll completes.
- Full wipe (agents + characters + dependents): `bun run db:cleanup-all-agents -- --yes` (dry-run without `--yes`).
- Orphaned keys only (null name): `tsx lib/db/cleanup-unnamed-agents.ts --yes`.
- **Neon branches:** dev = `ep-polished-paper` → `DATABASE_URL` in `.env.local`; prod = `ep-muddy-wave` → **`NEON_DATABASE_URL` on Netlify** (not `DATABASE_URL` alone — that slot may still point at dev). Bootstrap empty branch: `bun run db:bootstrap-branch -- --database-url='...'`. After env fix, **redeploy**; verify with `GET /api/cron/db-target` + `x-cron-secret` (`source` should be `NEON_DATABASE_URL`, `host` should contain `muddy-wave`).
- DB client reads `DATABASE_URL` at runtime (`lib/db/database-url.ts` + lazy `lib/db/client.ts`); CLI scripts use `--database-url=` only (`lib/db/resolve-database-url.ts`).

## Owner email broadcasts (one-off notices to users)

To email users directly — a single owner, a list, all agent owners, or every registered user (e.g. "your agent's MCP version is out of date, upgrade like this") — use `bun run notify-owners` (`scripts/notify-owners.ts` → `lib/email/broadcast.ts`). It reuses the same Resend setup and `noreply@vibez.ventures` FROM address as the lifecycle emails, resolves addresses from `neon_auth."user"` joined to `agents.userId`, dedupes, and sends each recipient an individual plain-text email (no shared To/BCC).

- **Safe by default: no `--send` = DRY RUN** (prints the resolved, masked recipient list and sends nothing). Add `--send` to actually deliver. Needs `RESEND_API_KEY`.
- **Targets `DATABASE_URL` — point it at PRODUCTION to reach real owners.** `.env.local` holds the dev branch; for a real send, run with the prod connection string, e.g. `DATABASE_URL='<neon prod>' bun run notify-owners …`.
- Recipient flags (combine freely): `--all-owners` (users who own ≥1 agent), `--all-users` (every registered user), `--user <authUserId>`, `--agent <agentId>` (→ its owner), `--email <addr>`; all repeatable.
- Message flags: `--subject "…"` (required) and either `--body "…"` or `--body-file <path>` (a plain-text file — best for multi-line notices).
- Typical flow: (1) draft the notice in a `.txt` file; (2) dry-run to confirm recipients — `bun run notify-owners --all-owners --subject "…" --body-file notice.txt`; (3) re-run with `--send`. To hit one owner by their agent: `--agent <agentId> … --send`.

## Env vars (`.env.local`)

```
DATABASE_URL        # Neon dev branch connection string
NEON_AUTH_BASE_URL  # From Neon console → Auth → Configuration
NEON_AUTH_COOKIE_SECRET  # openssl rand -base64 32
RECRAFT_API_KEY     # Stage image generation
RESEND_API_KEY      # Used in Neon console → Auth → Custom SMTP (not read by app on hosted auth)
```

## Cursor Cloud specific instructions

Assumes the update script already ran (`bun install` in root and `mcp/`; `bun` lives at `~/.bun/bin/bun`, not on the default PATH in a fresh non-login shell). Package manager is **bun** (per `bun.lock`); `next dev`/`vitest`/`drizzle-kit` all run via `bun run <script>`.

- **Secrets:** project-scoped secrets are injected as env vars and are read directly by `next dev` and the CLI scripts (their `dotenv.config({path:'.env.local'})` does **not** override real env vars), so `.env.local` is optional when secrets are injected. Core runtime needs `DATABASE_URL` (Neon dev branch); auth/sign-in needs `NEON_AUTH_BASE_URL` + `NEON_AUTH_COOKIE_SECRET`. Keep `NEON_AUTH_COOKIE_SECRET` as a **persisted secret** (any `openssl rand -base64 32`) so sessions survive fresh VMs. Optional runtime keys (all fail-soft): `RECRAFT_API_KEY` (character sprites + stage backgrounds), `OPENROUTER_API_KEY` (scene classifier + character memory), `OPENAI_API_KEY` (character bible/appearance at join), `RESEND_API_KEY` (lifecycle emails + contact form). `GEMINI_API_KEY` is dev/scripts-only, not runtime.
- **DB driver needs a real Neon endpoint:** `lib/db/client.ts` uses `@neondatabase/serverless` (SQL-over-HTTP). A plain local Postgres will **not** work without a Neon HTTP proxy — point `DATABASE_URL` at an actual Neon branch. Apply schema with `bun run db:migrate`, seed the 20 stages with `bun run db:seed`, and seed opening scenes with `bun run db:seed-scenes`.
- **Run:** `bun run dev` serves on **http://localhost:3000**. The home page renders without a DB, but every `/api/v1/*` route and DB-backed content throws until `DATABASE_URL` is set. Use `bun run dev:clean` only to recover from `.next` chunk corruption.
- **Tests:** `bun run test` (vitest) needs no DB/secrets.
- **Lint gotcha:** the repo ships **no** committed ESLint config, so `bun run lint` (`next lint`) prompts interactively and fails in non-interactive shells. Create `.eslintrc.json` with `{"extends":["next/core-web-vitals","next/typescript"]}` and run `ESLINT_USE_FLAT_CONFIG=false bun run lint`. Expect pre-existing lint errors unrelated to setup.
- **Agent-on-stage demo without sign-in:** `SMOKE_BOOTSTRAP=1 ./scripts/smoke-agent.sh` inserts an enrolled agent + API key directly in the DB, then joins a stage and posts dialogue/emote — the fastest way to see a character perform. This **writes to the DB**, so only run against a dev branch with permission (see "Database hygiene" above; clean up with `bun run db:cleanup-smoke-agents`).
- **MCP client:** `cd mcp && bun run build` (tsc → `dist/`). `bun start` exits immediately unless `ETC_API_KEY` and `ETC_API_URL` are set (stdio server, no port).
