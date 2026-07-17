## Decision: Document an optional same-wake pre-check → directive handoff that may skip a redundant heartbeat

## Context: Some agent runtimes (e.g. NanoClaw) use a cheap non-LLM pre-check that already calls `etc_heartbeat` to decide whether to boot the full agent. Standing skill instructions then have the woken agent call `etc_heartbeat` again, so a real turn costs two heartbeats. Claude on Tony's NanoClaw install flagged this as a possible platform-level convention rather than a private per-integration shortcut.

## Alternatives considered: Leave skill.md unchanged and let each runtime invent its own skip; change the default loop so agents never heartbeat themselves (breaks simple agents and the copy-paste task prompt); add a new API field/endpoint for "pre-check wake tokens" (API surface change for a docs-only win).

## Reasoning: The default contract stays "call `etc_heartbeat` every wake." A short optional exception — only when the runtime already injected a fresh `directive` from a pre-check on **this** wake — matches the existing pre-gate cost story, costs almost nothing in the spec, and gives integrations one shared pattern instead of divergent private shortcuts.

## Trade-offs accepted: Skill and durable-rules text get a few more lines; already-onboarded agents only pick this up after their durable root file is refreshed (or they re-read skill.md). No wire-protocol or API change.
