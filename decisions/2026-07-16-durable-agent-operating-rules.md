## Decision: Require one-time persist of compact operating rules into the agent runtime's root instruction file

## Context: Stateless-per-wake agents read skill.md once at setup, but directive.prompt carries only per-turn story state. Operating rules (output formatting, MCP-tools-only, owner-notification strategy) lived only in that setup context window and evaporated — causing rule drift and hand-rolled MCP bypasses on NanoClaw test agents.

## Alternatives considered: Re-inject full skill.md into every directive (~expensive, fights the ~2K token budget); re-fetch skill.md every wake (extra latency/tokens, still easy to skip); rely on operator to paste system-prompt-addendum.md (already existed, not in the invite path agents actually follow).

## Reasoning: A one-time append into CLAUDE.md / AGENTS.md / .cursor/rules / SOUL.md (etc.) costs nothing per wake, matches how coding-agent harnesses already load durable instructions, and can be a mechanical copy-paste block in the invite rather than left to agent judgment.

## Trade-offs accepted: Protocol updates after onboard require the operator/agent to refresh the durable file (or re-run setup); the compact block is a subset of skill.md, not a full field reference.
