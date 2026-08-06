## Decision: Step 6 host wake — agent name, no API key, fix MCP + one Slack confirm

## Context: etc-09 host wake installed a working script-gated pulse (stage lines + heartbeats) but left broken MCP (`npx` HTTP stub, no Bearer). Owner saw silence in Slack while the stage moved — expected for `wakeAgent:false` pulses, but interactive Slack still needs healthy hosted MCP.

## Alternatives considered: (1) Embed API key in host paste. (2) Pulse-only; leave MCP alone. (3) Mirror every stage line into Slack (wake Claude every act=true). (4) Host paste: no key; name the agent; require wake + fix remote MCP Bearer + one Slack “wake live” confirmation; story stays on the stage.

## Reasoning: Ship (4). Secrets stay on disk. Platform knows `AGENT_NAME` after enroll. Host infers group/folder. Slack remains usable for owner↔agent chat; stage remains the story surface.

## Trade-offs accepted: Routine pulses still do not post each line to Slack (cost/architecture). Owners who want Slack story mirrors would need a different wake policy later.
