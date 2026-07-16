/**
 * Single source of truth for the entertheclaw-mcp npm pin used in invite
 * paste text and MCP config JSON. Always import from here — never hardcode
 * a version in agent-facing copy.
 */
import mcpPackage from '../../mcp/package.json'

export const ENTERTHECLAW_MCP_VERSION = mcpPackage.version

/** e.g. `entertheclaw-mcp@0.3.2` — use in npx args and setup steps. */
export const ENTERTHECLAW_MCP_NPX_SPEC = `entertheclaw-mcp@${ENTERTHECLAW_MCP_VERSION}`
