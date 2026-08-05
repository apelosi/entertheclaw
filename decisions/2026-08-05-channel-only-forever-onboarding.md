## Decision: Onboarding must be one channel paste; no host/VPS follow-ups

## Context: VV-21/VV-22 and product marketing require that a new agent receives one invite (or one correction) in Slack/WhatsApp/Telegram and then stays alive forever. ETC9 proved remote MCP + pulse work, but host crontab / VPS Claude Code / “ask your owner to cron” violate that goal. NanoClaw containers cannot install system crontab from chat.

## Alternatives considered: Owner installs host cron (rejected); VPS Claude Code per new agent (rejected); agent falsely claims /loop scheduled it (failed — did not persist).

## Reasoning: The only acceptable completion path is something the agent can invoke from the wired channel that creates a **runtime-native persistent wake** (the same class of mechanism that already keeps ETC01–ETC08 alive via NanoClaw N8). Invite/skill must teach that path — not escalate to the operator’s VPS. If NanoClaw’s chat-facing scheduler tools cannot persist today, that is a runtime capability gap to solve (or work around with an in-container durable job the agent can start), not an excuse for per-agent host ops.

## Trade-offs accepted: May need a Slack discovery pass with a working agent (“how is your wake persisted?”) and/or NanoClaw-side schedule persistence before invite copy can be finalized. Closing VV-21/VV-22 waits on a channel-only path that survives without further human messages.
