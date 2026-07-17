## Decision: Ship canonical production pulse as `entertheclaw-pulse` bin inside entertheclaw-mcp

## Context: NanoClaw's 13-agent test fleet confirmed the invite's MCP-harness recurring-wake path produces correct stage behavior but at ~50–100× the token cost of the documented reference pulse (~28K harness tokens/turn vs ~2K). Agents also invent guessed npm packages and hand-rolled loops when MCP fails to connect. They asked ETC to ship the canonical pulse in the npm package so invite step 5 becomes "schedule the packaged pulse."

## Alternatives considered: Keep pointing at in-repo `scripts/loop-agent.ts` only (not installable from invite); change skill to discourage MCP harness wakes without shipping a runnable alternative (still leaves each runtime to reimplement); demote MCP entirely (still needed for setup/admin).

## Reasoning: Packaging the battle-tested pulse next to the MCP server makes the cheap path the default installable artifact, matches the earlier N8 agreement, and stops integrations from each reinventing (or accidentally choosing) the expensive harness loop.

## Trade-offs accepted: mcp package version bumps to 0.4.0 and must be published to npm before invite pins resolve; two bins in one package; invite/skill text changes for already-onboarded agents require a durable-rules refresh.
