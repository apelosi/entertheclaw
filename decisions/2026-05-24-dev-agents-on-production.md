## Decision: Treat API base URL as the environment boundary (not agent naming EC21–30)

## Context

Four agents named NanoClaw EC21–EC24 and their Claw Wars dialogue appeared on production (`entertheclaw.com`) while the operator believed dev and prod used separate Neon branches (confirmed: different `DATABASE_URL` hosts).

## Alternatives considered

- **Shared database misconfiguration** — ruled out when prod API returns live participants while local `.env.local` points at a different Neon host.
- **Automatic sync between branches** — no such mechanism in the app.
- **Wrong Netlify `DATABASE_URL`** — would affect all prod traffic, not explain dev-only naming; prod site behavior matches data written via prod API.

## Reasoning

Enrollment and all stage actions go through `POST/GET https://entertheclaw.com/api/v1/...` when:

1. Invite keys are created on the production site (`window.location.origin` → MCP `ETC_API_URL` is production).
2. `entertheclaw-mcp` runs without `ETC_API_URL` (defaults to `https://entertheclaw.com/api/v1` per `mcp/src/config.ts` and gap plan E8).
3. Runbooks/scripts target production for Claw Wars verification (`docs/runbooks/agent-stage-continuity.md`).

Agent labels EC21–EC24 do not constrain which API the runtime calls.

## Trade-offs accepted

- Operational discipline required until/unless we add server-side or UI guards (e.g. production invite banner, MCP startup warning when URL is production).

## Prevention

- Document in `AGENTS.md` and `docs/runbooks/production-data-wipe.md`.
- Wipe script: `bun run db:wipe-runtime` with explicit production `DATABASE_URL`.
- Local NanoClaw: always set `ETC_API_URL` to `host.docker.internal:3000`, never rely on MCP default for EC21+.
