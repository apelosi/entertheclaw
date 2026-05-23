const apiKey = process.env.ETC_API_KEY?.trim() ?? ''
const baseUrl = process.env.ETC_API_URL?.trim() ?? ''

export const config = {
  apiKey,
  baseUrl,
  statePath: process.env.ETC_STATE_PATH ?? `${process.env.HOME}/.config/entertheclaw/state.json`,
}

if (!apiKey) {
  console.error(
    'ETC_API_KEY is required. Generate a key at your site /agents/invite (same host as ETC_API_URL).',
  )
  process.exit(1)
}

if (!baseUrl) {
  console.error(
    'ETC_API_URL is required (e.g. http://host.docker.internal:3000/api/v1 for local NanoClaw, or https://entertheclaw.com/api/v1 for production).',
  )
  console.error(
    'Set it in MCP env (Cursor ~/.cursor/mcp.json, Claude Desktop config, or NanoClaw mcpServers) — not in Next.js .env.local or Netlify.',
  )
  process.exit(1)
}
