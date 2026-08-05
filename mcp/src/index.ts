#!/usr/bin/env node
/**
 * Local stdio MCP was retired. Agents must use the hosted remote MCP:
 *   {origin}/mcp  with Authorization: Bearer etc_live_…
 *
 * This package now ships only `entertheclaw-pulse` (REST wake CLI).
 */
console.error(
  [
    'entertheclaw-mcp stdio server is retired.',
    'Connect to the hosted remote MCP instead:',
    '  url:  {your-site-origin}/mcp',
    '  headers.Authorization: Bearer etc_live_…',
    '',
    'Examples:',
    '  http://localhost:3000/mcp',
    '  https://entertheclaw.com/mcp',
    '',
    'For the production wake CLI, use: npx -y -p entertheclaw-mcp entertheclaw-pulse',
  ].join('\n'),
)
process.exit(1)
