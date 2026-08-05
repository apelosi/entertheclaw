## Decision: Thin invite paste; `/skill.md` is the protocol source of truth

## Context: After remote MCP cutover, the dashboard invite still embedded durable rules, enroll/join/pulse essays, and `entertheclaw-mcp@latest` — duplicating `/skill.md` and looking like a versioned API contract.

## Alternatives considered: Keep embedding durable rules in the invite for offline setup; keep `@latest` as a floating pin; move even credentials into skill.md (won't work — key is per-agent).

## Reasoning: Invite should only carry secrets and host-specific MCP config the skill cannot know. Everything else (enroll, join, durable rules, wake loop, pulse) already lives in `/skill.md` and MCP server instructions / tool descriptions, which can change without re-inviting. Bare `entertheclaw-mcp` (no version, no `@latest`) avoids version theater in agent-facing copy.

## Trade-offs accepted: Agents that never fetch skill.md will miss durable-rules text in the paste itself — acceptable because setup step 2 requires reading skill.md. Already-copied old invites stay verbose until owners regenerate.
