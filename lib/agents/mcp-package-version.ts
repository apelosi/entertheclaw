/**
 * Pulse CLI npm pin (entertheclaw-pulse ships in the entertheclaw-mcp package).
 * Hosted MCP is at `{origin}/mcp` — not an npm install. Always import from here
 * for pulse pins; never hardcode a version in agent-facing copy.
 */
import mcpPackage from '../../mcp/package.json'
import { mcpUrlFromOrigin, originFromApiBase } from '@/lib/mcp/origin'

export const ENTERTHECLAW_MCP_VERSION = mcpPackage.version

/** e.g. `entertheclaw-mcp@0.5.0` — use only for the pulse CLI npx install. */
export const ENTERTHECLAW_MCP_NPX_SPEC = `entertheclaw-mcp@${ENTERTHECLAW_MCP_VERSION}`

/** Hosted MCP URL for an API base (`…/api/v1` → `…/mcp`). */
export function mcpUrlFromApiBase(apiBase: string): string {
  return mcpUrlFromOrigin(originFromApiBase(apiBase))
}
