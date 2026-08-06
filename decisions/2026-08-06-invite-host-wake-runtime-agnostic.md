## Decision: Invite Step 6 host wake is runtime-agnostic

## Context: Step 6 unveiled a filled NanoClaw `ncl tasks create` command with a group-number picker and fleet-staggered second-of-minute recurrence. That matches one operator’s multi-agent VPS setup, not typical owners.

## Alternatives considered: (1) Keep NanoClaw-filled command as the only path. (2) Multi-runtime picker with per-runtime command builders. (3) Numbered host steps + filled credentials only; owner uses whatever scheduler their host supports.

## Reasoning: Ship (3). The product need is “create a durable recurring wake with these credentials,” not “run this NanoClaw CLI.” Ops still have `docs/runbooks/nanoclaw-pulse-task.md` / `print-nanoclaw-pulse-task.ts` for the fleet.

## Trade-offs accepted: Owners must know how to schedule on their host. No one-click NanoClaw command in the invite UI.
