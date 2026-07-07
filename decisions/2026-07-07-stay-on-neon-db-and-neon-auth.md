# Decision: Stay on Neon (direct) for Postgres and keep Neon Auth — do NOT migrate to Netlify DB

## Context

Stack-consolidation impulse (2026-07-07): move the database (dev + prod) from Neon to Netlify DB so more of the stack lives in Netlify, with Neon Auth flagged as the big open question since Netlify has no obvious native auth. Three research streams were run (Netlify DB docs, Neon Auth/Better Auth docs, full codebase Neon-touchpoint inventory) before deciding.

## Alternatives considered

1. **Migrate to Netlify DB** — rejected. Netlify DB is Neon end-to-end: Netlify's GA changelog (https://www.netlify.com/changelog/2026-04-28-netlify-database/) and Neon's own blog (https://neon.com/blog/netlify-db-powered-by-neon) confirm it. Migrating means claiming the new database into a Neon account anyway, paying Netlify's credit markup on the same Neon compute (10 credits/CU, 20 credits/GB egress; no confirmed cost advantage), rewriting the driver to `drizzle-orm/netlify-db`, managing Neon indirectly through Netlify's CLI/dashboard instead of the Neon console, and accepting a documented brief write-loss window at cutover (per https://docs.netlify.com/build/data-and-storage/netlify-database/switch-to-netlify-database/). It does not remove the Neon dependency — it launders it through Netlify.
2. **Replace Neon Auth with self-hosted Better Auth** — rejected for now, but this is the documented exit door. Neon Auth IS Better Auth (v1.4.18) hosted by Neon; all four auth tables (`user`, `session`, `account`, `verification`) already live in our own Postgres under the `neon_auth` schema, including password hashes and OAuth links. Self-hosting would unlock 15–20+ OAuth providers (incl. Apple, which our codebase already has plumbing for but Neon Auth doesn't support) and the official hosted management UI at dash.better-auth.com (free Starter tier, via the `dash()` plugin — https://better-auth.com/docs/infrastructure/introduction, https://better-auth.com/pricing). Rejected because owner prefers Neon Auth's full-configuration console (OAuth/SMTP/trusted-domains/plugin toggles in UI); with self-hosted Better Auth those become code config in `auth.ts`, and only user/session management gets an official UI.
3. **Third-party Postgres (Supabase, RDS, etc.)** — rejected. Netlify has no non-Neon database product, so leaving Neon means adding a vendor rather than consolidating.

## Reasoning

Migration would not remove the Neon dependency, found no cost advantage (likely a markup), and the existing direct-Neon setup (dev/prod branches, Neon console, Neon MCP/CLI) is already the more mature agentic surface than Netlify DB's wrapper. Neither of the owner's stated "worth it anyway" criteria — big cost benefit or much simpler agentic/CLI engineering — held up under research.

## Trade-offs accepted

- Neon Auth's 3-provider cap (Google, GitHub, Vercel — no Apple sign-in despite existing plumbing in `lib/auth/`).
- Beta-package coupling: `@neondatabase/auth@^0.2.0-beta.1`.
- Continued dependency on Neon's hosted auth service (the API layer; the data itself is in our DB).
- Two dashboards/vendors (Netlify + Neon) instead of one.
- The Neon-Auth-specific workaround code stays (OAuth proxy routes, verifier-exchange middleware, iOS Safari cookie handling in `middleware.ts`, `lib/auth/oauth-callback.ts`, `app/api/auth/oauth-start/route.ts`).

## Key references

- Netlify switch guide: https://docs.netlify.com/build/data-and-storage/netlify-database/switch-to-netlify-database/
- Netlify DB GA changelog: https://www.netlify.com/changelog/2026-04-28-netlify-database/
- Neon "Netlify DB powered by Neon": https://neon.com/blog/netlify-db-powered-by-neon
- Netlify DB billing: https://docs.netlify.com/build/data-and-storage/netlify-database/billing-and-usage/
- Neon Auth overview: https://neon.com/docs/auth/overview
- Neon Auth OAuth providers (the 3-provider list): https://neon.com/docs/auth/guides/setup-oauth
- Better Auth Infrastructure dashboard + pricing: https://better-auth.com/docs/infrastructure/introduction, https://better-auth.com/pricing
- Better Auth admin plugin (API-only user management): https://better-auth.com/docs/plugins/admin
