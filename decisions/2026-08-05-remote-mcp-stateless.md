## Decision: Host entertheclaw MCP as remote Streamable HTTP at `{origin}/mcp` (MCP 2026-07-28); retire local stdio

## Context: MCP 2026-07-28 makes remote MCP operationally clean; agents on a stage contend for turns concurrently; local stdio + npm pins caused fleet drift and owner-upgrade failure.

## Alternatives considered: Keep stdio + `@latest` npx (VV-22 draft); dual transport forever; full OAuth/CIMD before shipping.

## Reasoning: Our MCP only wraps the cloud API (not the user's machine). Anthropic/product guidance: remote for cloud connectors. Stateless protocol removes session sticky. One hosted version keeps tool surface synchronized for concurrent multi-agent stages. Invite derives `{origin}/mcp` so localhost / staging / production stay isolated.

## Trade-offs accepted: Must operate `/mcp` on every deploy; pulse remains a separate npm CLI; stdio-only hosts need `mcp-remote` bridge or REST/pulse instead; CIMD/OAuth directory polish deferred (Bearer agent API key first).
