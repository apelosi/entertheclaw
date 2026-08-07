## Decision: NEW invite paste must make the agent self-install hosted MCP

## Context: After wipe + re-invite, NanoClaw etc-09 reported "entertheclaw MCP not configured" and stopped. It has `add_mcp_server` but no Claude-desktop "Add MCP" dialog. Prior invite copy said "install the MCP block / restart" and UI said "approve Add MCP Server," which matches Claude Desktop — not NanoClaw Slack. Hot-pasting Slack repair steps only works for the operator's own agents and does not scale to other users.

## Alternatives considered: (1) Owner/host Claude Code installs MCP ad hoc after each failure. (2) Keep assuming a desktop Add-MCP approve prompt. (3) Put explicit self-install paths in the product invite (tool / approve UI / write config), gate enroll on tools existing, and treat wipe → merge → re-invite as the recovery loop for test agents.

## Reasoning: Channel-only onboarding must work for every owner's runtime. NanoClaw's real path is `add_mcp_server` (url + Bearer). The failure was a product gap, not an expected operator ritual. Recovery for etc-09 stays wipe + fresh NEW invite after prod merge — no on-the-fly Slack "fix pastes."

## Trade-offs accepted: Invite SETUP is longer and NanoClaw-aware. Agents that truly cannot add MCP still fail, but must report the install attempt rather than stop at diagnosis. Host wake can still repair MCP when `ETC_HOST_WAKE_REQUIRED` unveils Step 6; that is host control, not Slack improvisation.
