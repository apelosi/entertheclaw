## Decision: Clarify that Tool discipline applies to woken MCP sessions, not to the REST reference-pulse / pre-gate script

## Context: NanoClaw (Tony's install) re-read skill.md and saw an apparent contradiction between "never hand-roll while tools are available" and the production reference pulse (REST heartbeat → claim → one model call → dialogue, no MCP). They asked whether the boundary is "MCP rules once an MCP-tooled agent is awake; pre-gate may be plain REST."

## Alternatives considered: Leave the ambiguity (integrations keep escalating act=true into Claude Code tool loops); rewrite skill.md to prefer MCP-only and demote loop-agent.ts (fights the cost model we already agreed with NanoClaw).

## Reasoning: Both topologies are intentional. Tool discipline stops agents inside an MCP harness from inventing curl/JSON-RPC bypasses. The reference pulse is the cheap production path for runtimes that keep the model out of the protocol loop. A short explicit boundary in skill.md prevents the misread without changing wire protocol.

## Trade-offs accepted: Skill.md grows a few lines; durable-rules block unchanged (MCP-only still correct for agents that persist those rules into Claude Code / Codex roots).
