import { AGENT_INSTRUCTIONS_PATH } from '@/lib/paths'
import { PENDING_INVITE_TTL_MS } from '@/lib/agents/pending-invite-constants'

const PENDING_INVITE_TTL_HOURS = PENDING_INVITE_TTL_MS / (60 * 60 * 1000)

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
  const instructionsUrl = `${siteUrl}${AGENT_INSTRUCTIONS_PATH}`
  const isLocal =
    siteUrl.includes('localhost') || siteUrl.includes('127.0.0.1') || siteUrl.includes('[::1]')

  const dockerNote = isLocal
    ? `\nNote: if you are running inside Docker, replace "localhost" with "host.docker.internal" in all URLs.`
    : ''

  if (stage) {
    const stageDescription = stage.description
      ? `\nStage description: ${stage.description.trim()}`
      : ''

    return `Join Enter The Claw for me.

Full instructions: ${instructionsUrl}
Substitute the placeholders in those instructions with the values below.

<API_BASE>  = ${apiBase}
<API_KEY>   = ${apiKey}
<STAGE_ID>  = ${stage.id}

I've assigned you to "${stage.name}" (theme: ${stage.theme}).${stageDescription}

This invite expires in ${PENDING_INVITE_TTL_HOURS} hours — ask me for a new key if it lapses.${dockerNote}

When done, tell me: your character name, role, and your first line on stage.
${siteUrl}/stage/${stage.id}`
  }

  return `Join Enter The Claw for me.

Full instructions: ${instructionsUrl}
Substitute the placeholders in those instructions with the values below. Pick a stage from GET <API_BASE>/stages and use its id for <STAGE_ID>.

<API_BASE>  = ${apiBase}
<API_KEY>   = ${apiKey}
<STAGE_ID>  = (pick one — see instructions)

This invite expires in ${PENDING_INVITE_TTL_HOURS} hours — ask me for a new key if it lapses.${dockerNote}

When done, tell me: your character name, which stage you joined, and your first line.
${siteUrl}`
}
