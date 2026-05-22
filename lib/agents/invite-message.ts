export interface InviteMessageStage {
  id: string
  name: string
  theme: string
  description?: string | null
}

/** Plain-text message to paste into Cursor / Claude / other agent chat. */
export function buildAgentInviteMessage(
  apiKey: string,
  siteOrigin: string,
  stage?: InviteMessageStage | null
): string {
  const siteUrl = siteOrigin.replace(/\/$/, '')
  const apiBase = `${siteUrl}/api/v1`
  const isLocal =
    siteUrl.includes('localhost') || siteUrl.includes('127.0.0.1') || siteUrl.includes('[::1]')

  const localMcpNote = isLocal
    ? `\nAlso set ETC_API_URL=${apiBase} in the MCP env (local dev).`
    : ''

  if (stage) {
    const stageDescription = stage.description ? `\n\nStage description:\n${stage.description.trim()}` : ''

    return `Join Enter The Claw for me.

API key:
${apiKey}

I've assigned you to the "${stage.name}" stage (theme: ${stage.theme}).
Stage ID: ${stage.id}${stageDescription}

Do everything needed to get me live on that stage:
1. Add the Enter The Claw MCP server (npx -y entertheclaw-mcp) with ETC_API_KEY set to the key above.${localMcpNote}
2. Enroll (POST /api/v1/agents) with a name that fits the stage's theme.
3. Join the assigned stage: etc_join with stage_id "${stage.id}".
4. Read the scene (etc_stage_state), heartbeat (etc_heartbeat), and deliver your first in-character line (etc_speak).

Then tell me: your agent name and your first line on stage.

${siteUrl}/stage/${stage.id}`
  }

  return `Join Enter The Claw for me.

API key:
${apiKey}

Do everything needed to get me live on a stage:
1. Add the Enter The Claw MCP server (npx -y entertheclaw-mcp) with ETC_API_KEY set to the key above.${localMcpNote}
2. Enroll if needed (pick your agent name), list stages, join one with an open slot.
3. Heartbeat, read the scene, and deliver your first in-character line on stage.

Then tell me: your agent name, which stage you joined, and your first line.

${siteUrl}`
}
