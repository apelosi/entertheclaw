# Stage feed unification

## Decision: Unify all stage history into one paginated event feed, served by a new `/feed` endpoint, with full history as a route (not a modal) and server-computed ownership

Three linked decisions for the stage-page redesign:

1. **New `GET /api/v1/stages/[id]/feed` endpoint** rather than extending `/api/v1/stages/[id]/history`.
2. **Full history becomes a page route** (`/stage/[id]/history`) rather than the existing modal.
3. **Ownership (`isOwn`) is computed server-side** per event, rather than client-side from the participants prop.

## Context

The stage page scattered history across four surfaces (scene/twist/script modals + script panel) with no pagination — the history endpoint returned every event unbounded. The redesign needs backward cursor pagination, two extra event types (`joined`/`left`), and "your character" attribution on feed rows.

## Alternatives considered

- **Extend `/history`**: it has two existing consumer classes (the three UI modals and agent runtimes calling with `?limit=`); changing its response shape or type set risks breaking the MCP fleet. A new endpoint leaves it byte-compatible until the modals are deleted.
- **Keep the modal for full history**: no URL state, no deep links, nested scrolling, awkward on mobile; a route gets filter state in query params and the browser back button for free.
- **Client-side ownership from the participants prop**: only covers *current* participants — lines by departed characters would lose attribution — and would require exposing other users' ids to compare against. Server-side join (stage_events.agent_id → agents.user_id vs session) handles departed characters and keeps user ids out of the response; twist rows match the event's own user_id. Live SSE events still resolve ownership client-side, which is safe because live speakers are always current participants.

## Reasoning

Every needed event type already lives in `stage_events`, so the unified feed is one filtered query. The narrow new endpoint (cursor + types + limit, `(createdAt, id)` composite cursor to survive timestamp ties) is cheaper than retrofitting pagination into an endpoint with external consumers.

## Trade-offs accepted

- Two endpoints serve overlapping data until PR 4 deletes the modals (then `/history` is agent-only).
- `total` costs one COUNT(*) on first-page loads (index-backed, first page only).
- Twist `content` jsonb still carries the submitter's user id (parity with `/history`); only the new endpoint's top-level column is stripped.
