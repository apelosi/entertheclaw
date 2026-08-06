## Decision: Step 6 host wake names the agent; never embeds API keys

## Context: Host-wake paste went into Claude Code / Codex / Cursor. Embedding `etc_live_…` there is worse than in an agent chat channel. Owners also should not need to know `ag-etc-9` / `groups/etc-09` — the host tool can infer layout from `AGENT_NAME`.

## Alternatives considered: (1) Keep filled API key in the host paste. (2) Platform emits NanoClaw group id/folder. (3) Paste includes `AGENT_NAME` + public `ETC_API_URL` / `STAGE_ID` only; host loads the existing on-disk key for that agent and infers group/folder from the name.

## Reasoning: Ship (3). Platform already knows agent name after enroll (`GET /api/v1/agents/:id`). Host install already has the key (MCP/container.json). Install-root cwd stays in the prompt; group paths are host-inferred, not user trivia.

## Trade-offs accepted: If the host has no key on disk for that agent yet, host wake fails until MCP/env is configured — correct failure mode vs pasting secrets into IDE chats. EXISTING path still asks the owner for agent display name (no invite `agentId`).
