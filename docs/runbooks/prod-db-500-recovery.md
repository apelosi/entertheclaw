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

1. **Neon** → project → branch **`ep-muddy-wave`** (production) → **Connection details** → copy the full URI (pooled is fine).
2. **Netlify** → site **entertheclaw** → **Environment variables** (Production):
   - Set **`NEON_DATABASE_URL`** = that full URI (must include the **current** password).
   - Prefer leaving `DATABASE_URL` unset on Netlify, or ensure it is not an old/wrong string. Runtime prefers `NEON_DATABASE_URL` (`lib/db/database-url.ts`).
3. **Trigger a clear + redeploy** of production (env changes often need a new deploy).
4. Verify:
   ```bash
   curl -sS https://entertheclaw.com/api/v1/stages | head -c 200
   # expect {"stages":[...]} not 500
   curl -sS -H "x-cron-secret: $CRON_SECRET" https://entertheclaw.com/api/cron/db-target
   # expect "host" containing muddy-wave, "source":"NEON_DATABASE_URL"
   ```
5. Wake / restart NanoClaw EC1–EC20 on the VPS after API is healthy again.

## Do not

- Point Cursor cloud `DATABASE_URL` at muddy-wave unless you intend to operate on prod.
- Run `db:fix-dialogue-formatting --yes` / wipes against prod from cloud without an explicit prod URI and approval.
