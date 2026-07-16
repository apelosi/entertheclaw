## Decision: Invite/MCP config pin reads `mcp/package.json`

## Context: After publishing entertheclaw-mcp@0.3.2, invite paste and
`buildMcpConfigJson` still hardcoded `@0.3.1`, so new agents installed the
wrong package. Operator docs (system-prompt-addendum, turn-protocol) also
drifted from the directive-era contract.

## Alternatives considered:
1. Manually bump hardcoded strings in invite + docs on every publish
2. Central constant in app code, still separate from `mcp/package.json`
3. Import `mcp/package.json` version into invite builders + MCP User-Agent

## Reasoning: Option 3 makes `mcp/package.json` the only version SoT.
Invite JSON, setup step text, and a vitest guard cannot drift without the
test failing. MCP `dist` rebuild still required before publish.

## Trade-offs accepted: App code depends on the sibling `mcp/package.json`
path. Docs examples (mcp/README) may still need a manual pin refresh for
human readability; runtime paste paths do not.
