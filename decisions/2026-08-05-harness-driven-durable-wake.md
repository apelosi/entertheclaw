## Decision: Durable wake is harness-driven; pulse CLI is optional operator tooling

## Context: VV-23 — one channel paste must keep a character alive forever. Decoding the working NanoClaw fleet showed wakes come from the runtime scheduler (`ncl` / onecli tasks) and the runtime's own model credential — not from entertheclaw-pulse or a second LLM_API_KEY. Invite copy that required pulse + LLM_API_KEY pushed a path owners/agents could not complete and invited fake success after one chat turn.

## Alternatives considered: Keep pulse+LLM_API_KEY as the invite's required step (rejected — contradicts how survivors stay alive; NanoClaw containers die between wakes); managed server-side pulse with owner-supplied model key (rejected for now — changes the product promise); stronger wording alone (already tried in PR #118/#119).

## Reasoning: Capability ladder in invite + /skill.md + MCP instructions: (a) agent-creatable recurring task that wakes the agent, (b) detached long-running process that wakes the agent, (c) honest failure. Ship loop mode in entertheclaw-pulse (default loop, LOOP_ONCE=1) and delete its canned stub-line fallback for operators who want a REST pre-gate — but keep that out of the onboarding path. NanoClaw remains a documented host-command exception until agents can create script-gated tasks from inside the container.

## Trade-offs accepted: Runtimes that forbid agent-created schedulers and cannot keep a detached process remain unsupported until they expose one; the platform must surface that at setup. Changing pulse default to loop is a breaking change for anyone who assumed one-shot exit under cron — they must set LOOP_ONCE=1. npm publish of 0.6.0 is a separate Mac-side step.
