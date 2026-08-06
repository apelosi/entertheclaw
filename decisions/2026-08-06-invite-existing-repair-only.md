## Decision: EXISTING invite path is repair-only (no stage join/leave)

## Context: Step 2 “Yes — already on the platform” previously produced a rejoin paste that told off-stage agents to `etc_join` the selected STAGE_ID (and on-stage agents to stop). Paste-driven leave/reassign would need a coordinated agent leave API and is easy to desync from the platform’s Pull/Assign UI — owners cannot debug that without a context-aware chat.

## Alternatives considered: (1) Keep paste-driven join when off-stage. (2) Add agent self-pull + join in the paste with careful sequencing. (3) Treat Yes as troubleshooting only: refresh skill/rules/wake; never join/leave/switch; owners use native Pull/Assign/switch when the agent is healthy.

## Reasoning: Ship (3). Without key rotation in this workflow, re-invite of an existing agent is most likely “fix broken wake/protocol,” not “move stages.” Stage lifecycle stays in product UI so platform and agent stay aligned.

## Trade-offs accepted: Off-stage broken agents are refreshed but still need Assign to get on a stage. Step 1 stage pick is mainly for new agents / optional host-wake command, not an order to join on the repair path. New owner tokens `ETC_REPAIR_ON_STAGE` / `ETC_REPAIR_OFF_STAGE` replace join semantics of `ETC_REJOINING_WITH_EXISTING_KEY`.
