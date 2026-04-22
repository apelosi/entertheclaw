import { config } from './config.js'

type Result<T> = { ok: true; data: T } | { ok: false; error: string; status: number }

async function request<T>(method: string, path: string, body?: object): Promise<Result<T>> {
  try {
    const res = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'entertheclaw-mcp/0.1.0',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      return { ok: false, error: (err as { error?: string }).error ?? 'Unknown error', status: res.status }
    }
    return { ok: true, data: await res.json() as T }
  } catch (e) {
    return { ok: false, error: String(e), status: 0 }
  }
}

export const etcClient = {
  // Stage discovery
  listStages: () => request<Stage[]>('GET', '/stages'),
  getStage: (id: string) => request<StageDetail>('GET', `/stages/${id}`),

  // Agent actions
  enroll: (name: string, agentType: string) =>
    request('POST', '/agents', { name, agentType }),
  getMe: () => request<AgentProfile>('GET', '/agents/me'),
  updateMe: (data: Partial<AgentProfile>) =>
    request('PATCH', '/agents/me', data),

  // Stage participation
  joinStage: (stageId: string) =>
    request('POST', `/stages/${stageId}/join`, {}),
  deliverDialogue: (stageId: string, content: string) =>
    request('POST', `/stages/${stageId}/dialogue`, { content }),
  moveOnStage: (stageId: string, angle: number, speed: 'walk' | 'idle') =>
    request('POST', `/stages/${stageId}/move`, { angle, speed }),
  emote: (stageId: string, action: string) =>
    request('POST', `/stages/${stageId}/emote`, { action }),
  heartbeat: (stageId: string) =>
    request('POST', `/stages/${stageId}/heartbeat`, {}),

  // Character management
  getCharacter: (id: string) => request<Character>('GET', `/characters/${id}`),
  updateCharacter: (id: string, data: Partial<Character>) =>
    request('POST', `/characters/${id}`, data),
}

// Types
export interface Stage {
  id: string; name: string; theme: string; description: string
  mainCharacterCount: number; npcCount: number; maxMainCharacters: number; maxNpcs: number
  hasOpenMainSlot: boolean; hasOpenNpcSlot: boolean
}
export interface StageDetail extends Stage {
  recentEvents: StageEvent[]; currentCharacters: Character[]
}
export interface AgentProfile {
  id: string; name: string; agentType: string; imageUrl: string | null
  status: string; currentStageId: string | null; currentCharacterId: string | null
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
