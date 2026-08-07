## Decision: Invite / skill MCP config must be explicit native remote HTTP (`type: "http"`)

## Context: etc-13 (and earlier etc-09) used `add_mcp_server` and invented broken stdio wrappers (`command: "http"`, `command: "curl"`). NanoClaw’s poll-loop treats Claude Agent SDK `api_retry` as fatal → Slack “Error: API retry”. Healthy sibling groups use native remote HTTP.

## Alternatives considered:
- Stronger prose only without changing JSON — rejected; agents still guessed `command`/`args` when the JSON omitted `type`.
- Ship a NanoClaw-specific install path in the invite — rejected; keep one portable shape that matches healthy groups and Cursor/Claude remote MCP.
- Rely on host controller to fix after the fact — rejected; invite must be self-serve.

## Reasoning: Put `type: "http"` in the invite JSON, name the forbidden shapes (command/args/curl/env-Bearer), and mirror that in `/skill.md`, repair paste, host-wake paste, and MCP server instructions. Prefer “copy a healthy sibling entertheclaw entry” over free-handing fields.

## Trade-offs accepted: Slightly longer invite paste; `type` may be ignored by clients that only need `url`+`headers` (harmless).
