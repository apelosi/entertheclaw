# VV-21 → VV-22 cutover checklist (running)

**Owner of truth for this workstream.** Update checkboxes as steps complete.  
**PR:** https://github.com/apelosi/entertheclaw/pull/115  
**Branch:** `cursor/remote-mcp-2026-07-28-a338`  
**Issues:** [VV-21](https://linear.app/vibezventures/issue/VV-21) (hosted remote MCP) → [VV-22](https://linear.app/vibezventures/issue/VV-22) (fleet migrate + thin invites)

Related runbooks:

- Env/DB promotion: `docs/runbooks/neon-environments-and-db-scripts.md`
- npm after prod: `docs/runbooks/publish-entertheclaw-mcp.md`
- Fleet paste / Zain email: `docs/runbooks/remote-mcp-fleet-migration.md`

---

## Who does what

| Actor | Owns |
|-------|------|
| **Cloud agent** | Code on PR, unit tests, local **dev** smoke of `/mcp` + invite shape, fix Netlify build, update this checklist, draft pastes |
| **You (operator)** | Review PR, confirm staging URL, **merge to prod** when ready, `npm deprecate` on Mac, paste to owned agents, `notify-owners --send` for Zain (prod DB) |
| **Neither yet** | Treat staging/prod MCP as live until verified on that host |

---

## Honest test status (as of last agent update)

| Check | Env | Result | Notes |
|-------|-----|--------|-------|
| `bun run test` (vitest) | Cloud VM / no DB | **PASS** — 194 tests | Unit/contract only; not a live MCP e2e |
| `bun run build` (Next) | Cloud VM | **PASS** (after script fix; needs `NEON_AUTH_COOKIE_SECRET` in env) | `/mcp` route present in build output |
| Netlify PR deploy | Staging preview | **FAIL** (after type fix) | Likely missing preview secrets / broader Netlify break since #112 — see evidence log |
| `POST /mcp` unauthenticated → 401 | Dev (earlier this PR) | Partial | Auth reject only; not full tool e2e |
| Full e2e: enroll → join → heartbeat → claim → speak via `/mcp` | Dev | **NOT RUN** | Needs `bun run dev` + real/dev agent key (DB write — needs your OK for smoke bootstrap) |
| Staging `/mcp` e2e | Staging | **NOT RUN** | Wait for green Netlify preview |
| Prod `/mcp` | Production | **NOT RUN** | Do not merge until staging green |
| npm deprecate stdio | npmjs | **NOT DONE** | After prod verify |
| Fleet paste (13 owned) | Prod agents | **NOT DONE** | After prod verify |
| Zain email | Prod | **NOT DONE** | After prod verify |

**Rule you called out (agreed):** if results + environment are not written here, assume the test was **not** run.

---

## Phase A — VV-21 code + **dev** verify (before staging)

App/API-only change (no Neon migrate). Still must prove on **dev** first.

- [x] Hosted `/mcp` route + tool registration in app
- [x] Invites emit remote `{ url, headers }` (no stdio/`npx` MCP)
- [x] No exact package versions in agent-facing copy (`@latest` only for optional pulse)
- [x] Decision logged: `decisions/2026-08-05-remote-mcp-stateless.md`
- [x] Unit tests green (`bun run test`)
- [x] **`bun run build` green** locally (Cloud VM + `NEON_AUTH_COOKIE_SECRET`) — unblocks Netlify once pushed
- [ ] **Dev server up** (`bun run dev` on Cloud VM or your Mac) against Neon **dev**
- [ ] Dev: unauthenticated `POST http://localhost:3000/mcp` → 401
- [ ] Dev: authenticated MCP tool path works (at least tools/list + one read tool; prefer full enroll→join→heartbeat→claim→speak with explicit permission for any DB bootstrap)
- [ ] Dev: dashboard invite paste shows `http://localhost:3000/mcp` (or current origin), not production host
- [ ] Record results in the table above (date + who)

**Stop here until build + at least auth + one authenticated MCP call pass on dev.**

---

## Phase B — Staging (Netlify preview / branch)

- [ ] Netlify PR deploy **green**
- [ ] Note staging URL: `https://________________/mcp`
- [ ] Staging: unauthenticated POST → 401
- [ ] Staging: authenticated smoke (same as dev; staging Neon if app is wired to it)
- [ ] Staging: invite from that origin embeds matching `{staging-host}/mcp`
- [ ] Record results in the table above

**You review PR. Do not merge until Phase B is green.**

---

## Phase C — Production (you merge)

- [ ] You merge PR #115 to `main` (Netlify prod deploy)
- [ ] Prod: `https://entertheclaw.com/mcp` unauthenticated → 401
- [ ] Prod: authenticated smoke with a **non-fleet** test key or one owned agent (careful)
- [ ] Prod: new invite shows `https://entertheclaw.com/mcp`
- [ ] Mark VV-21 Done in Linear (acceptance criteria met)

---

## Phase D — Post-merge ops (VV-22 cutover)

Order matters. Do **not** paste fleet / email Zain before prod `/mcp` works.

- [ ] **npm (your Mac):** deprecate stdio package — see `docs/runbooks/publish-entertheclaw-mcp.md`  
  `npm deprecate entertheclaw-mcp "… remote-only …"`  
  (Publishing a new MCP server version is **not** required.)
- [ ] **Owned agents:** paste shared placeholder message from `docs/runbooks/remote-mcp-fleet-migration.md` (agents fill `YOUR_ETC_API_KEY`)
- [ ] **Zain:** dry-run then send via `notify-owners` (prod `DATABASE_URL`) — body in that runbook
- [ ] Confirm a few owned agents report remote MCP connected
- [ ] Mark VV-22 Done in Linear

---

## Phase E — Out of scope / later

- [ ] VV-20 (Neon compute) — separate; do not assume transport alone fixes cost
- [ ] Optional pulse-only npm publish / rename
- [ ] OAuth/CIMD directory polish

---

## Current “you are here”

**Phase A mid-flight.** Code on draft PR #115; unit tests + local production build pass after script fix; **full authenticated MCP e2e on running `bun run dev` still not recorded**; staging URL not verified yet.

### Immediate next steps

1. **Agent (this chat):** push build fix; watch Netlify; run/record **dev** `/mcp` smokes (ask before any `SMOKE_BOOTSTRAP` / DB agent inserts).  
2. **You:** no action until Phase B is green — then review PR.  
3. **You:** merge only after Phase B.  
4. **You:** Phase D (npm deprecate → agent pastes → Zain email).

---

## Evidence log (append-only)

| When (UTC) | Env | What | Result | By |
|------------|-----|------|--------|-----|
| 2026-08-05 ~07:34 | Cloud VM | `bun run test` | 194 passed | agent |
| 2026-08-05 ~07:26 | Cloud VM | `POST /mcp` no auth | 401 (partial) | agent |
| 2026-08-05 ~07:44 | Cloud VM | `bun run build` | FAIL — verify-pair-backoff `characterId` | agent |
| 2026-08-05 ~07:40 | Netlify PR | Deploy | FAIL | netlify |
| 2026-08-05 ~07:46 | Cloud VM | `bun run build` (+ cookie secret) | PASS — `/mcp` in route table | agent |
| 2026-08-05 ~07:47 | Netlify deploy-preview | Deploy after 0b26fa7 | FAIL (~50s); preview URL 404; build logs not readable via API token | [ci-watcher](bc-7ad4fc16-2710-5a28-b484-c73534a88c33) |
| 2026-08-05 | Netlify production | Last `ready` deploy | 2026-07-18 `0bd1515` (PR #111). Prod merges #112/#113 also `error` — site still serving that older deploy (`/mcp` → 404 on prod) | agent |
