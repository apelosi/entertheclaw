# Neon environments & DB scripts (agents + Linear)

How Enter The Claw talks to Postgres across **dev / staging / production**, and how cloud agents run migrations and data scripts **without pasting connection strings into chat**.

## Cursor secrets (source of truth)

Set these on the Cursor Cloud Agents environment for this repo. Values must be **full** Neon URLs (`postgresql://…`), never password-only.

| Environment | Cursor secret | Neon endpoint (typical) | Default use |
|-------------|---------------|-------------------------|-------------|
| **Dev** | `NEON_DATABASE_URL_DEV` | `ep-polished-paper…` | Local + cloud agents by default; safe experiments |
| **Staging** | `NEON_DATABASE_URL_STAGING` | staging branch (prod copy) | Dry-run / apply destructive or data-fix scripts before prod. **Not live-synced** — refresh from prod (see below). |
| **Production** | `NEON_DATABASE_URL_PRODUCTION` | `ep-muddy-wave…` | Explicit only; after merge + staging verify |

Also:

- App runtime on Netlify prod uses **`NEON_DATABASE_URL`** (or the slot documented in `AGENTS.md`) — keep that in sync when rotating passwords.
- Local Mac: put **dev** in `.env.local` as `DATABASE_URL`. Do not put prod in `.env.local`.

**Renames:** prefer `NEON_DATABASE_URL_PRODUCTION` (not `_PROD`). If an old `_PROD` secret still exists, delete it to avoid confusion.

## Never paste URLs in chat

- Agents read secrets as env vars. You do **not** need to paste `postgresql://…` into Linear, Slack, or Cursor chat.
- When sharing terminal output, redact lines that contain the URL, or paste only from `Target: ep-…` downward (hostname is enough).
- Prefer:

  ```bash
  export DATABASE_URL="$NEON_DATABASE_URL_STAGING"   # or PRODUCTION — set in your shell, not in chat
  bun run db:migrate
  bun run --no-env-file db:remediate-copyright -- --database-url="$DATABASE_URL"
  ```

- Cloud agent secret updates apply to **new** agent runs only. An already-running chat keeps the secrets it started with.

## Script conventions

Most maintenance CLIs take an explicit target:

```bash
bun run --no-env-file <script> -- --database-url="$NEON_DATABASE_URL_STAGING"
```

- **`--no-env-file`** — stop Bun from loading `.env.local` (dev) over your intended target.
- **Dry-run by default** where implemented; pass `--apply` / `--yes` only after reviewing output.
- Schema: `DATABASE_URL='…' bun run db:migrate` (drizzle-kit uses `DATABASE_URL`).
- Copyright remediations (`db:remediate-copyright`): if leftovers are already 0 but `copyright_remediations` is empty, backfill with `--apply --record-verified`.

## Recommended sequence (data or schema changes)

This sequence is **not** optional when the change touches Neon data or schema. It applies whether the work started from a Linear issue, a Slack ping, or a Cursor chat — Linear is the tracking surface, not a switch that “turns on” the runbook.

1. **Linear issue** describes the change and which envs are in scope (create one if the request did not start in Linear).
2. **PR** lands code (migrations, scripts, app changes) — verify against **dev** first.
3. **Merge** when review is done (Netlify does **not** auto-run drizzle migrate).
4. **Staging:** migrate → dry-run script → `--apply` → verify.
5. **Production:** same commands with `NEON_DATABASE_URL_PRODUCTION`.
6. Comment on the Linear issue what ran (env, leftovers, audit rows). Mark **Done**.

For **app/API-only** changes (no migrations / no data scripts): still use Linear + PR; verify on **dev** (and Netlify preview / staging deploy when available) before merge to `main` (production). Skip the DB migrate/`--apply` steps unless schema or data is involved.

If migrate fails with “column already exists”, prod’s schema may be ahead of `drizzle.__drizzle_migrations`. Fix the journal (or apply the missing SQL) before re-running — see VV-10 / ops notes; do not force-reapply additive migrations.

## Refreshing staging from production

Staging is a **Neon child branch of production**, not a continuously synced replica. It drifts as soon as prod (or staging itself) gets writes. Refresh it before any data script you care about matching live prod.

### How to see when staging was last updated from prod

1. **Neon Console (source of truth):** [console.neon.tech](https://console.neon.tech) → project → **Branches** → open the **staging** branch (`ep-fragrant-glitter…`).
   - Confirm **Parent** is production (`ep-muddy-wave…` / `main`).
   - Read **Last data reset** on that page (Neon updates this when you use Reset from parent).
2. **Repo log (human-readable reminder):** update the table below every time you refresh. Agents should check both; if they disagree, trust Neon.

| When (UTC) | Source | Method | By | Notes |
|------------|--------|--------|----|-------|
| 2026-07-17 (approx) | production HEAD | Neon branch created/duplicated from prod | owner | Initial staging for VV-10 ops. Confirm exact time via Neon **Last data reset**. |

### A. Refresh staging to **current** production (HEAD)

Use this for “make staging look like prod right now.” **Overwrite** — all staging-only data/schema changes are discarded. Connection string stays the same (Cursor secret usually does **not** need updating).

**Console**

1. Neon → **Branches** → **staging**.
2. Confirm Parent = production.
3. **Actions** → **Reset from parent** (or use the **Last data reset** panel).
4. Confirm. Wait until the branch is ready.
5. Add a row to the table above.
6. Re-run any pending migrations only if prod is behind code (unusual); normally staging now matches prod schema+data.

**CLI** (optional; needs [Neon CLI](https://neon.com/docs/reference/cli-install) + auth)

```bash
neon branches reset staging --parent
# if multiple projects:
# neon branches reset staging --parent --project-id <project-id>
```

Docs: [Reset from parent](https://neon.com/docs/guides/reset-from-parent).

### B. Refresh staging to production at a **timestamp** (point-in-time)

Reset from parent is **HEAD only**. For “prod as of `2026-07-15T18:00:00Z`”, restore staging from the parent’s history:

**CLI** (RFC 3339 UTC timestamp)

```bash
neon branches restore staging '^parent@2026-07-15T18:00:00.000Z'
```

If Neon asks to preserve the old staging tip (e.g. staging has child branches), add:

```bash
neon branches restore staging '^parent@2026-07-15T18:00:00.000Z' \
  --preserve-under-name "staging_pre_refresh_$(date -u +%Y%m%dT%H%MZ)"
```

**Console alternative — new branch from history, then cut over**

1. Neon → **Branches** → **New branch**.
2. Parent = **production**.
3. Choose create from **past** / timestamp (within the project **History window**: Settings → Instant restore).
4. Name it (e.g. `staging-2026-07-15`).
5. Point apps/secrets at the **new** connection string, **or** delete old staging and rename the new branch to `staging` (only if you are comfortable with that cutover).
6. If the hostname changed, update Cursor secret `NEON_DATABASE_URL_STAGING` (and any Netlify staging slot). New secret values apply to **new** cloud agent runs only.

Docs: [Instant restore](https://neon.com/docs/introduction/branch-restore), [CLI branches restore](https://neon.com/docs/cli/branches#restore).

### When to refresh

- Before dry-run / `--apply` of a destructive or data-fix script meant to preview **prod**.
- After large prod incidents or bulk remediations, if staging must match.
- Anytime Neon **Last data reset** is older than you trust for the change you’re testing.

### Caveats

- Staging must remain a **child of production**. If Parent is empty/wrong, Reset from parent will not work — recreate staging as a child of prod, then update the secret if the host changes.
- Reset/restore **interrupts connections** briefly; the URL usually stays stable for Reset from parent.
- Do **not** refresh staging mid-script if you still need staging-only experiment rows.
- Never paste the new connection string into Linear/chat; update the Cursor secret in the dashboard.

## Starting a new cloud agent with DB access

1. Confirm secrets in Cursor dashboard: `NEON_DATABASE_URL_DEV`, `_STAGING`, `_PRODUCTION` are full URLs.
2. Open a **new** Cloud Agent chat (this picks up current secrets).
3. Paste a short handoff (issue id, branch/PR, exact commands, success criteria). Do **not** include connection strings.

Example handoff shape:

```text
Continue VV-… Read docs/runbooks/neon-environments-and-db-scripts.md.

Secrets available: NEON_DATABASE_URL_STAGING, NEON_DATABASE_URL_PRODUCTION
(never ask me to paste URLs).

Remaining work:
1. On staging: migrate + dry-run + apply <script>
2. On production: same
3. Confirm leftovers=0 and audit rows exist
4. Comment on Linear + update PR

Branch: …  PR: …
```

## Related

- Branch DB client vs CLI: `lib/db/database-url.ts`, `lib/db/resolve-database-url.ts`
- Prod wipe: `docs/runbooks/production-data-wipe.md`
- Dev PITR (not staging refresh): `docs/RECOVER-DEV-DATA.md`
- Agent env boundary (ETC_API_URL): `AGENTS.md`
- Neon: [Reset from parent](https://neon.com/docs/guides/reset-from-parent) · [Instant restore](https://neon.com/docs/introduction/branch-restore)
