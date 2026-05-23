## Decision: Force runtime DATABASE_URL reads on Netlify

## Context

Netlify production env showed `ep-muddy-wave` (main) but live API returned stage UUIDs from `ep-polished-paper` (dev). Muddy had zero tables; paper held all data.

## Reasoning

`lib/db/client.ts` created the Neon client at module load with `process.env.DATABASE_URL`, which Next.js/OpenNext can inline at **build** time. Changing Netlify env without fixing code does not switch the DB the deploy uses.

## Fix

- `readDatabaseUrl()` via `process.env['DATABASE_URL']` (lazy client Proxy)
- `export const dynamic = 'force-dynamic'` on root + `app/api` layouts
- `GET /api/internal/db-target` (CRON_SECRET) returns host + counts after deploy

## Trade-offs accepted

- Whole app opts out of static page caching (correctness over edge cache for DB-backed pages)

## Recovery (2026-05-24)

- Bootstrapped muddy: migrate + 20 stages + 20 origin stories
- Dev (paper): wipe runtime, keep origins
- Redeploy required for production to read muddy at runtime
