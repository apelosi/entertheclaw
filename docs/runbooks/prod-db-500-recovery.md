# Production DB 500 / “Application error” recovery

## Symptom

- `https://entertheclaw.com/api/v1/stages` → `{"error":"Internal server error"}` (500)
- Browser: “Application error: a server-side exception has occurred… Digest: …”
- Fleet agents all `DOWN (not heartbeating)` at the same time

## Cause (what it is / isn’t)

| Action | Breaks prod website? | Breaks agent heartbeats? |
|--------|----------------------|---------------------------|
| Point local/`bun run dev` at **prod** `DATABASE_URL` | **No** (Netlify has its own env) | **No** by itself |
| **Rotate Neon prod password** and forget to update Netlify `NEON_DATABASE_URL` | **Yes** | **Yes** (API can’t write heartbeats) |
| Cursor cloud agent on default secrets | Uses **dev** `ep-polished-paper` only | N/A |

`GET /api/v1/stages` is a plain `SELECT` on `stages`. A 500 here almost always means **Netlify cannot authenticate/connect to Neon**, not a dialogue-format or MCP bug.

## Fix (do this now — Netlify + Neon consoles)

**WHERE:** Neon console + Netlify site settings (not this repo, not Cursor cloud).

### Do **not** change auth vars for a DB password rotate

| Netlify var | Purpose | Update when DB password changes? |
|-------------|---------|----------------------------------|
| `NEON_AUTH_BASE_URL` | Neon Auth (sign-in) host | No |
| `NEON_AUTH_COOKIE_SECRET` | Session cookie signing | **No** (unrelated to Postgres password) |
| **`NEON_DATABASE_URL`** | Preferred Postgres URI | Yes if present |
| **`DATABASE_URL`** | Fallback Postgres URI (used when `NEON_DATABASE_URL` unset) | **Yes — update this if that is the only DB secret** |

Auth secrets alone cannot fix API 500s. Many sites only have `DATABASE_URL` (no `NEON_DATABASE_URL`); that is fine — `readDatabaseUrl()` falls back to it.

1. **Neon** → project → branch **`ep-muddy-wave`** (production) → **Connection details** → copy the full URI (pooled is fine). Must use the **current** password after your rotates.
2. **Netlify** → site **entertheclaw** → **Environment variables** → **Production** / **Runtime** (not Build-only):
   - Update **`DATABASE_URL`** (or add `NEON_DATABASE_URL`) to that full `postgresql://…` URI.
   - Check scopes: Shared vs Production; UI filters can hide vars.
3. **Redeploy is required** — changing the env value alone does **not** update the running site. Deploys → **Trigger deploy** → **Clear cache and deploy site** (or equivalent).
4. Verify:
   ```bash
   curl -sS https://entertheclaw.com/api/v1/stages | head -c 200
   # expect {"stages":[...]} not 500
   curl -sS -H "x-cron-secret: $CRON_SECRET" https://entertheclaw.com/api/cron/db-target
   # expect "host" containing muddy-wave, "source":"NEON_DATABASE_URL"
   ```
5. Wake / restart NanoClaw EC1–EC20 on the VPS after API is healthy again.

## Do not

- Rotate or rewrite `NEON_AUTH_COOKIE_SECRET` to “fix” DB connectivity (it won’t; it will only invalidate sessions).
- Point Cursor cloud `DATABASE_URL` at muddy-wave unless you intend to operate on prod.
- Run `db:fix-dialogue-formatting --yes` / wipes against prod from cloud without an explicit prod URI and approval.
