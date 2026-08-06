## Decision: Step 6 host wake includes agent identity; NanoClaw workdir is install root

## Context: After ETC_HOST_WAKE_REQUIRED, owners were unsure whether to open Claude Code in `~/nanoclaw-v2` or `groups/etc-09`, and the host paste listed `ETC_API_KEY` without saying to embed it in the scheduled wake. Agent name was missing even though enroll had already written it.

## Alternatives considered: (1) Keep generic prompt. (2) Hardcode NanoClaw `ncl` command again. (3) Poll enrolled agent by invite `agentId`, put AGENT_NAME + inferred `ag-etc-N` / `groups/etc-0N` in the paste, instruct install-root cwd, and explicitly require embedding credentials in the host task.

## Reasoning: Ship (3). Normal NanoClaw ops run Claude Code at the install root and pass `--group`; cd’ing into the group folder is not the usual flow. Platform already has `agentId` from keys and `name` after enroll — expose via `GET /api/v1/agents/:id` (session owner).

## Trade-offs accepted: EXISTING repair path still needs the owner to type the agent name (no new key → no invite agentId). Prompt may briefly say AGENT_NAME unknown until enroll completes (UI polls).
