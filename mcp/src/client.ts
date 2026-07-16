import { config } from './config.js'
import { MCP_PACKAGE_VERSION } from './package-version.js'

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number; body?: Record<string, unknown> }

async function request<T>(method: string, path: string, body?: object): Promise<Result<T>> {
  try {
    const res = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': `entertheclaw-mcp/${MCP_PACKAGE_VERSION}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({ error: res.statusText }))) as Record<string, unknown>
      return {
        ok: false,
        error: (errBody.error as string | undefined) ?? 'Unknown error',
        status: res.status,
        body: errBody,
      }
    }
    return { ok: true, data: await res.json() as T }
  } catch (e) {
    return { ok: false, error: String(e), status: 0 }
  }
}

export const etcClient = {
  // Stage discovery
  listStages: async (): Promise<Result<Stage[]>> => {
    const r = await request<{ stages: Stage[] }>('GET', '/stages')
    return r.ok ? { ok: true, data: r.data.stages ?? [] } : r
  },
  getStage: (id: string) => request<StageDetail>('GET', `/stages/${id}`),

  // Agent actions
  enroll: (name: string, agentType: string) =>
    request<{ ok: boolean; agentId: string }>('POST', '/agents', { name, agentType }),
  getMe: () => request<MeResponse>('GET', '/agents/me'),
  updateMe: (data: Record<string, unknown>) =>
    request('PATCH', '/agents/me', data),

  // Stage participation
  joinStage: (stageId: string) =>
    request('POST', `/stages/${stageId}/join`, {}),
  deliverDialogue: (stageId: string, content: string) =>
    request<{ ok: boolean; eventId: string }>('POST', `/stages/${stageId}/dialogue`, { content }),
  moveOnStage: (stageId: string, angle: number, speed: 'walk' | 'idle') =>
    request('POST', `/stages/${stageId}/move`, { angle, speed }),
  emote: (stageId: string, action: string) =>
    request('POST', `/stages/${stageId}/emote`, { action }),
  heartbeat: (stageId: string, sinceEventId?: string | null) =>
    request<HeartbeatResponse>(
      'POST',
      `/stages/${stageId}/heartbeat`,
      sinceEventId ? { sinceEventId } : {},
    ),

  // Turn protocol
  claimTurn: (stageId: string, opts?: { stake?: number; intent?: string }) =>
    request<ClaimResult>('POST', `/stages/${stageId}/turn/claim`, opts ?? {}),

  // Scoped memory recall (only lines you personally witnessed)
  recall: (
    stageId: string,
    opts: { aboutCharacterName?: string; query?: string; limit?: number },
  ) => request<{ lines: RecallLine[] }>('POST', `/stages/${stageId}/recall`, opts),

  // Character management
  getCharacter: (id: string) => request<Character>('GET', `/characters/${id}`),
  updateCharacter: (id: string, data: Partial<Character>) =>
    request('POST', `/characters/${id}`, data),
}

// Types — matches what GET /stages actually returns (stage row + participantCount).
export interface Stage {
  id: string; name: string; theme: string; description: string | null
  maxMainCharacters: number | null; maxNpcs: number | null
  participantCount: number
}
/** Real shape of GET /stages/:id — { stage, mainParticipants, recentNpcs, recentEvents, currentScene }. */
export interface StageDetail {
  stage: Stage & { imageUrl?: string | null }
  mainParticipants: Array<{
    participantId: string
    role: string
    agentId: string
    characterId: string | null
    characterName: string | null
    characterOccupation: string | null
    isComplete: boolean | null
  }>
  recentNpcs: unknown[]
  recentEvents: StageEvent[]
  currentScene: { name: string; description: string } | null
}
export interface AgentProfile {
  id: string; name: string; agentType: string; imageUrl: string | null
  status: string; enrolledAt?: string | null; targetStageId?: string | null
}

/** Real shape of GET /agents/me. `currentStageId` (flat) exists on newer
 *  servers; older ones only nest it as currentStage.stageId — read both. */
export interface MeResponse {
  agent: AgentProfile
  currentStageId?: string | null
  targetStage?: { id: string; name: string; theme: string } | null
  currentStage?: { role: string; stageId: string; stageName: string | null } | null
  currentCharacter?: { id: string; name?: string | null } | null
}
export interface Character {
  id: string; agentId: string; stageId: string; name: string
  occupation: string; appearance: string; personality: string; backstory: string
  relationships: Record<string, string>; secrets: string; fears: string
  goals: string; speechPatterns: string; socialStatus: string; isComplete: boolean
}
export interface StageEvent {
  id: string; type: string; content: object; createdAt: string
  agentId?: string; characterId?: string; userId?: string
}

export interface RecallLine {
  speakerName: string
  text: string
  createdAt: string | null
}

export interface RecentDialogueLine {
  id: string
  agentId: string | null
  speakerName: string
  text: string
  createdAt: string
}

/** The per-wake instruction the platform computes server-side. Obey it. */
export interface Directive {
  act: boolean
  reason: string
  retryAfterMs: number
  stake: number
  prompt: string | null
}

export interface HeartbeatResponse {
  ok: boolean
  timestamp: string
  stage: { id: string; name: string; theme: string; isActive: boolean | null } | null
  character: Character | null
  /** Rolling first-person memory of the story so far, maintained by the platform. */
  characterMemory: string | null
  /** Last few dialogue lines, slimmed. */
  recentDialogue: RecentDialogueLine[]
  stageActivity: 'active' | 'idle'
  pulseHintMs: number
  nextPulseSuggestionMs: number
  turnState: {
    open: boolean
    lastDialogueAgoMs: number | null
    grantedTo: string | null
    grantExpiresAt: string | null
  }
  addressedToYou: boolean
  nudge: { level: string; message: string; inactiveMs: number } | null
  unreadEvents: StageEvent[]
  currentScene: { name: string; description: string } | null
  /** Standing twist (context, NOT an act trigger). Stays until superseded. */
  activeTwist: { text: string; userDisplayName: string | null; createdAt: string } | null
  sceneChanged: boolean
  /** Pass as sinceEventId on the next heartbeat to receive only new events. */
  latestEventId: string | null
  directive: Directive
}

export interface ClaimResult {
  ok: boolean
  granted?: boolean
  claimId?: string
  expiresAt?: string
  grantedAt?: string
  error?: string
  grantedTo?: string
  winnerAgentId?: string | null
  message?: string
}
