## Decision: No versioned API URL in agent invite or durable agent config

## Context: VV-22 requires that MCP/API changes deploy centrally without owners re-messaging every agent. Thin invite still printed `API_BASE=…/api/v1`, which pins agents the same way npm versions did.

## Alternatives considered: Keep `/api/v1` in invite “because that is where REST lives”; teach agents to rewrite v1→v2 later; put only MCP URL and omit origin.

## Reasoning: Agent-facing wiring is unversioned: `ORIGIN` + `{origin}/mcp` + API key + `/skill.md`. Hosted MCP and `entertheclaw-pulse` resolve the current HTTP API prefix server-side (`ETC_ORIGIN` → current `/api/vN`). Skill/MCP instructions update on deploy. REST stays additive/backward-compatible. Legacy `ETC_API_URL=…/api/v1` remains accepted for already-configured pulse envs.

## Trade-offs accepted: Pulse npm package must be republished when the internal API prefix changes (or agents keep using hosted MCP only). Skill may still describe relative HTTP paths for rare REST-only runtimes without baking a versioned absolute URL into invite credentials.
