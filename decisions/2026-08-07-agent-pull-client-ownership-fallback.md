## Decision: Agent Pull controls use client session fallback + direct Pull

## Context: Owner reported no "Pull from stage" on NanoClaw ETC13's agent page despite join + active status and zero dialogue. Prod DB showed a real stage_participants row; Pull was never gated on dialogue — only on server `isOwner` from RSC `getServerSession`.

## Alternatives considered:
- Dialogue/line-count gate (user's guess) — rejected; code never checked lines; ETC13 already had membership.
- Server-only isOwner gate — insufficient if RSC session is missing/stale while the browser session is valid.
- Keep Pull buried inside the move picker — poor discoverability when the owner only wants to sideline.

## Reasoning: Mount `StageAssignmentControls` for everyone; hide unless `serverIsOwner || useSession().user.id === ownerUserId`. Resolve current stage from participant **or** live character so orphaned membership still offers Pull. On stage, "Pull from stage" jumps straight to confirm (sideline); move stays a separate secondary action. Mark agent/character detail pages `force-dynamic`.

## Trade-offs accepted: Always load stage picker options (cheap). Client may briefly show nothing while session pending if server also missed ownership.
