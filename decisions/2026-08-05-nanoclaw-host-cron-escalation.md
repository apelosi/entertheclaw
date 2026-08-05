## Decision: Invite must escalate to the owner when the agent cannot persist host cron

## Context: ETC9 verified `entertheclaw-pulse` end-to-end from Slack, then correctly reported it has no system crontab and no CronCreate tool inside the NanoClaw container. Asking the agent chat to “schedule the recurring wake” cannot finish NanoClaw setup.

## Alternatives considered: Keep telling the agent to schedule anyway; invent in-container forever-loop (reaped / expensive); only document in ops runbooks.

## Reasoning: Invite/skill already require a host-persisted pulse. Add an explicit failure path: if the runtime cannot write host cron, the agent must not claim setup complete — it must give the owner the exact cron/pulse line once. Closing VV-21/VV-22 for NanoClaw still requires a one-time host Claude Code / crontab install per new group (same class of work as remote MCP host config).

## Trade-offs accepted: New NanoClaw agents still need a short owner/host step for the scheduler. Remote MCP + unversioned API_BASE remain centrally updatable; only the host cron entry is per-agent.
