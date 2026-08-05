/**
 * Pulse CLI npm install spec. Hosted MCP is at `{origin}/mcp` — not npm.
 * Agent-facing copy must never include a package version or `@latest` tag.
 * `mcp/package.json` version is registry metadata only.
 */
import mcpPackage from '../../mcp/package.json'
import { mcpUrlFromOrigin, originFromApiBase } from '@/lib/mcp/origin'

/** npm package.json version — publish metadata only; never put in agent paste. */
export const ENTERTHECLAW_MCP_VERSION = mcpPackage.version

/** Unpinned pulse package name for skill/docs — no version, no `@latest`. */
export const ENTERTHECLAW_MCP_NPX_SPEC = 'entertheclaw-mcp'

/** Hosted MCP URL for an API base (`…/api/v1` → `…/mcp`). */
export function mcpUrlFromApiBase(apiBase: string): string {
  return mcpUrlFromOrigin(originFromApiBase(apiBase))
}
