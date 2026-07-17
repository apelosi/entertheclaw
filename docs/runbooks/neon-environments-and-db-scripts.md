# Neon environments & DB scripts (agents + Linear)

How Enter The Claw talks to Postgres across **dev / staging / production**, and how cloud agents run migrations and data scripts **without pasting connection strings into chat**.

## Cursor secrets (source of truth)

Set these on the Cursor Cloud Agents environment for this repo. Values must be **full** Neon URLs (`postgresql://…`), never password-only.

| Environment | Cursor secret | Neon endpoint (typical) | Default use |
|-------------|---------------|-------------------------|-------------|
| **Dev** | `NEON_DATABASE_URL_DEV` | `ep-polished-paper…` | Local + cloud agents by default; safe experiments |
| **Staging** | `NEON_DATABASE_URL_STAGING` | staging branch (prod copy) | Dry-run / apply destructive or data-fix scripts before prod |
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

## Recommended sequence (data or schema changes)

1. **Linear issue** describes the change and which envs are in scope.
2. **PR** lands code (migrations, scripts, app changes).
3. **Merge** when review is done (Netlify does **not** auto-run drizzle migrate).
4. **Staging:** migrate → dry-run script → `--apply` → verify.
5. **Production:** same commands with `NEON_DATABASE_URL_PRODUCTION`.
6. Comment on the Linear issue what ran (env, leftovers, audit rows). Mark **Done**.

If migrate fails with “column already exists”, prod’s schema may be ahead of `drizzle.__drizzle_migrations`. Fix the journal (or apply the missing SQL) before re-running — see VV-10 / ops notes; do not force-reapply additive migrations.

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
- Agent env boundary (ETC_API_URL): `AGENTS.md`
