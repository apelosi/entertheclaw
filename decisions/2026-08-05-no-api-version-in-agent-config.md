## Decision: No versioned API URL in agent invite or durable agent config

## Context: VV-22 requires that MCP/API changes deploy centrally without owners re-messaging every agent. Thin invite still printed `API_BASE=…/api/v1`, which pins agents the same way npm versions did.

## Alternatives considered: Keep `/api/v1` in invite; rename credential to `ORIGIN` only; teach agents to rewrite v1→v2 later.

## Reasoning: Keep the familiar `API_BASE` name, but make it unversioned: `{origin}/api`. Next rewrites map `/api/{agents,stages,…}` → current `/api/v1/…`. Invite also carries `MCP_URL`, key, and stage fields (including `STAGE_URL`) in CREDENTIALS. Hosted MCP and pulse use the same unversioned base. Legacy `ETC_API_URL=…/api/v1` remains accepted. Skill/MCP instructions update on deploy.

## Trade-offs accepted: Rewrite table must stay in sync when new agent HTTP resources are added under `/api/v1`. Internal routes can stay versioned; agent-facing contract does not.
