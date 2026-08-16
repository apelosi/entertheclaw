/**
 * Single-statement heartbeat read (VV-20).
 *
 * Production was ~12–16 neon-http round-trips per pulse (each checkout runs
 * RESET ALL / session boilerplate). One json_build_object SELECT plus optional
 * debounced presence UPDATEs keeps directive.prompt assembly intact.
 */
import { db } from '@/lib/db/client'
import { agents, stageParticipants } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import {
  ACTIVE_PARTICIPANT_MS,
  ACTIVE_RECENT_EVENT_MS,
  classifyStageActivityFromSignals,
  findActiveGrantFromEvents,
  type ActiveGrant,
} from '@/lib/stage/turn-state'
import { shouldUpdatePresence } from '@/lib/stage/idle-pulse'
import type { CurrentScene } from '@/lib/stage/apply-scene-classifier'

const RECENT_EVENT_LIMIT = 80
const UNREAD_CAP = 30
const RECENT_DIALOGUE_LIMIT = 16

export interface HeartbeatEventRow {
  id: string
  stageId: string
  type: string
  agentId: string | null
  characterId: string | null
  userId: string | null
  content: unknown
  createdAt: Date | null
}

export interface HeartbeatCharacter {
  id: string
  agentId: string
  stageId: string
  name: string | null
  occupation: string | null
  appearance: string | null
  personality: string | null
  backstory: string | null
  relationships: unknown
  secrets: string | null
  fears: string | null
  goals: string | null
  speechPatterns: string | null
  socialStatus: string | null
  memory: string | null
  memoryCursorEventId: string | null
  memoryUpdatedAt: Date | null
  imageUrl: string | null
  spriteUrl: string | null
  assetsVersion: number | null
  isComplete: boolean | null
  createdAt: Date | null
  updatedAt: Date | null
}

export interface HeartbeatContext {
  participant: {
    id: string
    joinedAt: Date | null
    lastActiveAt: Date | null
    lastSpokeAt: Date | null
  } | null
  stage: {
    id: string
    name: string
    theme: string
    isActive: boolean | null
    initialSceneName: string | null
    initialSceneDescription: string | null
  } | null
  character: HeartbeatCharacter | null
  recentDialogueRows: HeartbeatEventRow[]
  unreadEvents: HeartbeatEventRow[]
  stageActivity: 'active' | 'idle'
  activeGrant: ActiveGrant | null
  currentScene: CurrentScene | null
  participantCount: number
  agentLastDialogueMs: number | null
  lastDialogueAt: number | null
  latestTwistEvent: HeartbeatEventRow | null
  activeAgentIds: string[]
}

interface RawEvent {
  id?: unknown
  stageId?: unknown
  type?: unknown
  agentId?: unknown
  characterId?: unknown
  userId?: unknown
  content?: unknown
  createdAt?: unknown
}

interface RawBundle {
  participant: {
    id: string
    joinedAt: unknown
    lastActiveAt: unknown
    lastSpokeAt: unknown
  } | null
  stage: {
    id: string
    name: string
    theme: string
    isActive: boolean | null
    initialSceneName: string | null
    initialSceneDescription: string | null
  } | null
  character: Record<string, unknown> | null
  recentEvents: RawEvent[] | null
  latestTwist: RawEvent | null
  latestSceneChange: RawEvent | null
  participantCount: number | null
  activeAgentIds: string[] | null
  sinceCreatedAt: unknown
}

function coerceDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'string') {
    const s = /Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

function coerceEvent(raw: RawEvent | null | undefined): HeartbeatEventRow | null {
  if (!raw || typeof raw.id !== 'string' || typeof raw.type !== 'string') return null
  return {
    id: raw.id,
    stageId: typeof raw.stageId === 'string' ? raw.stageId : '',
    type: raw.type,
    agentId: typeof raw.agentId === 'string' ? raw.agentId : null,
    characterId: typeof raw.characterId === 'string' ? raw.characterId : null,
    userId: typeof raw.userId === 'string' ? raw.userId : null,
    content: raw.content ?? null,
    createdAt: coerceDate(raw.createdAt),
  }
}

function isActivityType(type: string): boolean {
  return type === 'dialogue' || type === 'twist' || type === 'scene_change'
}

function mapCharacter(raw: Record<string, unknown> | null): HeartbeatCharacter | null {
  if (!raw || typeof raw.id !== 'string') return null
  return {
    id: raw.id,
    agentId: typeof raw.agentId === 'string' ? raw.agentId : '',
    stageId: typeof raw.stageId === 'string' ? raw.stageId : '',
    name: typeof raw.name === 'string' ? raw.name : null,
    occupation: typeof raw.occupation === 'string' ? raw.occupation : null,
    appearance: typeof raw.appearance === 'string' ? raw.appearance : null,
    personality: typeof raw.personality === 'string' ? raw.personality : null,
    backstory: typeof raw.backstory === 'string' ? raw.backstory : null,
    relationships: raw.relationships ?? null,
    secrets: typeof raw.secrets === 'string' ? raw.secrets : null,
    fears: typeof raw.fears === 'string' ? raw.fears : null,
    goals: typeof raw.goals === 'string' ? raw.goals : null,
    speechPatterns: typeof raw.speechPatterns === 'string' ? raw.speechPatterns : null,
    socialStatus: typeof raw.socialStatus === 'string' ? raw.socialStatus : null,
    memory: typeof raw.memory === 'string' ? raw.memory : null,
    memoryCursorEventId:
      typeof raw.memoryCursorEventId === 'string' ? raw.memoryCursorEventId : null,
    memoryUpdatedAt: coerceDate(raw.memoryUpdatedAt),
    imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : null,
    spriteUrl: typeof raw.spriteUrl === 'string' ? raw.spriteUrl : null,
    assetsVersion: typeof raw.assetsVersion === 'number' ? raw.assetsVersion : null,
    isComplete: typeof raw.isComplete === 'boolean' ? raw.isComplete : null,
    createdAt: coerceDate(raw.createdAt),
    updatedAt: coerceDate(raw.updatedAt),
  }
}

export function assembleHeartbeatContext(
  raw: RawBundle,
  nowMs: number,
): HeartbeatContext {
  const recentEvents = (raw.recentEvents ?? [])
    .map((e) => coerceEvent(e))
    .filter((e): e is HeartbeatEventRow => e !== null)

  const recentDialogueRows = recentEvents
    .filter((e) => e.type === 'dialogue')
    .slice(0, RECENT_DIALOGUE_LIMIT)

  const sinceCreatedAt = coerceDate(raw.sinceCreatedAt)
  let unreadEvents: HeartbeatEventRow[]
  if (sinceCreatedAt) {
    unreadEvents = recentEvents.filter(
      (e) => (e.createdAt?.getTime() ?? 0) > sinceCreatedAt.getTime(),
    )
  } else {
    const lastActive = coerceDate(raw.participant?.lastActiveAt)
    unreadEvents = lastActive
      ? recentEvents.filter(
          (e) => (e.createdAt?.getTime() ?? 0) >= lastActive.getTime(),
        )
      : recentEvents.slice(0, 10)
  }
  unreadEvents = unreadEvents.slice(0, UNREAD_CAP)

  const latestTwistEvent =
    coerceEvent(raw.latestTwist) ??
    recentEvents.find((e) => e.type === 'twist') ??
    null

  const latestScene = coerceEvent(raw.latestSceneChange)
  let currentScene: CurrentScene | null = null
  if (latestScene?.content && typeof latestScene.content === 'object') {
    const c = latestScene.content as Record<string, unknown>
    if (typeof c.name === 'string' && typeof c.description === 'string') {
      currentScene = { name: c.name, description: c.description }
    }
  }
  if (
    !currentScene &&
    raw.stage?.initialSceneName &&
    raw.stage?.initialSceneDescription
  ) {
    currentScene = {
      name: raw.stage.initialSceneName,
      description: raw.stage.initialSceneDescription,
    }
  }

  const recentCutoff = nowMs - ACTIVE_RECENT_EVENT_MS
  const hasRecentActivity = recentEvents.some(
    (e) => isActivityType(e.type) && (e.createdAt?.getTime() ?? 0) >= recentCutoff,
  )
  const activeAgentIds = (raw.activeAgentIds ?? []).filter(
    (id): id is string => typeof id === 'string',
  )
  const stageActivity = classifyStageActivityFromSignals({
    hasRecentActivity,
    activeParticipantCount: activeAgentIds.length,
  })

  const lastDialogueAt = recentDialogueRows[0]?.createdAt
    ? recentDialogueRows[0].createdAt.getTime()
    : null
  const lastSpokeAt = coerceDate(raw.participant?.lastSpokeAt)

  return {
    participant: raw.participant
      ? {
          id: raw.participant.id,
          joinedAt: coerceDate(raw.participant.joinedAt),
          lastActiveAt: coerceDate(raw.participant.lastActiveAt),
          lastSpokeAt,
        }
      : null,
    stage: raw.stage,
    character: mapCharacter(raw.character),
    recentDialogueRows,
    unreadEvents,
    stageActivity,
    activeGrant: findActiveGrantFromEvents(recentEvents, nowMs),
    currentScene,
    participantCount: Number(raw.participantCount ?? 0),
    agentLastDialogueMs: lastSpokeAt ? lastSpokeAt.getTime() : null,
    lastDialogueAt,
    latestTwistEvent,
    activeAgentIds,
  }
}

export async function loadHeartbeatContext(opts: {
  stageId: string
  agentId: string
  sinceEventId: string | null
  now: Date
}): Promise<HeartbeatContext> {
  const activeCutoff = new Date(opts.now.getTime() - ACTIVE_PARTICIPANT_MS)
  const sinceSelect = opts.sinceEventId
    ? sql`(SELECT created_at FROM stage_events WHERE id = ${opts.sinceEventId}::uuid LIMIT 1)`
    : sql`null::timestamp`

  const result = await db.execute(sql`
    SELECT json_build_object(
      'participant', (
        SELECT json_build_object(
          'id', id,
          'joinedAt', joined_at,
          'lastActiveAt', last_active_at,
          'lastSpokeAt', last_spoke_at
        )
        FROM stage_participants
        WHERE stage_id = ${opts.stageId}::uuid
          AND agent_id = ${opts.agentId}::uuid
        LIMIT 1
      ),
      'stage', (
        SELECT json_build_object(
          'id', id,
          'name', name,
          'theme', theme,
          'isActive', is_active,
          'initialSceneName', initial_scene_name,
          'initialSceneDescription', initial_scene_description
        )
        FROM stages
        WHERE id = ${opts.stageId}::uuid
        LIMIT 1
      ),
      'character', (
        SELECT json_build_object(
          'id', id,
          'agentId', agent_id,
          'stageId', stage_id,
          'name', name,
          'occupation', occupation,
          'appearance', appearance,
          'personality', personality,
          'backstory', backstory,
          'relationships', relationships,
          'secrets', secrets,
          'fears', fears,
          'goals', goals,
          'speechPatterns', speech_patterns,
          'socialStatus', social_status,
          'memory', memory,
          'memoryCursorEventId', memory_cursor_event_id,
          'memoryUpdatedAt', memory_updated_at,
          'imageUrl', image_url,
          'spriteUrl', sprite_url,
          'assetsVersion', assets_version,
          'isComplete', is_complete,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        FROM characters
        WHERE agent_id = ${opts.agentId}::uuid
          AND stage_id = ${opts.stageId}::uuid
        LIMIT 1
      ),
      'recentEvents', (
        SELECT coalesce(json_agg(row_json ORDER BY created_at DESC), '[]'::json)
        FROM (
          SELECT json_build_object(
            'id', id,
            'stageId', stage_id,
            'type', type,
            'agentId', agent_id,
            'characterId', character_id,
            'userId', user_id,
            'content', content,
            'createdAt', created_at
          ) AS row_json,
          created_at
          FROM stage_events
          WHERE stage_id = ${opts.stageId}::uuid
          ORDER BY created_at DESC
          LIMIT ${RECENT_EVENT_LIMIT}
        ) recent
      ),
      'latestTwist', (
        SELECT json_build_object(
          'id', id,
          'stageId', stage_id,
          'type', type,
          'agentId', agent_id,
          'characterId', character_id,
          'userId', user_id,
          'content', content,
          'createdAt', created_at
        )
        FROM stage_events
        WHERE stage_id = ${opts.stageId}::uuid AND type = 'twist'
        ORDER BY created_at DESC
        LIMIT 1
      ),
      'latestSceneChange', (
        SELECT json_build_object(
          'id', id,
          'stageId', stage_id,
          'type', type,
          'agentId', agent_id,
          'characterId', character_id,
          'userId', user_id,
          'content', content,
          'createdAt', created_at
        )
        FROM stage_events
        WHERE stage_id = ${opts.stageId}::uuid AND type = 'scene_change'
        ORDER BY created_at DESC
        LIMIT 1
      ),
      'participantCount', (
        SELECT count(*)::int FROM stage_participants
        WHERE stage_id = ${opts.stageId}::uuid
      ),
      'activeAgentIds', (
        SELECT coalesce(json_agg(agent_id), '[]'::json)
        FROM stage_participants
        WHERE stage_id = ${opts.stageId}::uuid
          AND last_active_at >= ${activeCutoff}
      ),
      'sinceCreatedAt', ${sinceSelect}
    ) AS bundle
  `)

  const row = (result as { rows?: Array<{ bundle?: RawBundle }> }).rows?.[0]
  const bundle = row?.bundle
  if (!bundle) {
    return assembleHeartbeatContext(
      {
        participant: null,
        stage: null,
        character: null,
        recentEvents: [],
        latestTwist: null,
        latestSceneChange: null,
        participantCount: 0,
        activeAgentIds: [],
        sinceCreatedAt: null,
      },
      opts.now.getTime(),
    )
  }
  return assembleHeartbeatContext(bundle, opts.now.getTime())
}

export async function maybeTouchPresence(opts: {
  agentId: string
  participantId: string
  agentLastHeartbeatAt: Date | null
  participantLastActiveAt: Date | null
  now: Date
}): Promise<void> {
  const tasks: Promise<unknown>[] = []
  if (shouldUpdatePresence(opts.agentLastHeartbeatAt, opts.now)) {
    tasks.push(
      db
        .update(agents)
        .set({ lastHeartbeatAt: opts.now })
        .where(eq(agents.id, opts.agentId)),
    )
  }
  if (shouldUpdatePresence(opts.participantLastActiveAt, opts.now)) {
    tasks.push(
      db
        .update(stageParticipants)
        .set({ lastActiveAt: opts.now })
        .where(eq(stageParticipants.id, opts.participantId)),
    )
  }
  if (tasks.length > 0) await Promise.all(tasks)
}
