## Decision: Use local dev (not cloud preview) for Phase 0–2 verification

## Context: Closing PRD gap; user asked whether to test locally or via cloud agents.

## Alternatives considered: Local `bun run dev` + Neon dev DB; Netlify preview + staging; parallel cloud agents hitting preview.

## Reasoning: Fastest feedback for auth/API debugging; `.env.local` already wired; MCP can target `http://localhost:3000/api/v1`. Parallel implementation agents only need git branches, not a shared host. Cloud preview deferred until OAuth on localhost fails or a stable public URL is required.

## Trade-offs accepted: OAuth redirect must include localhost in Neon console; laptop must run dev server for browser tests; no shared URL for external testers until preview is set up.
