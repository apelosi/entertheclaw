/**
 * Build the snapshot payload embedded in every `turn_open` stage_event.
 *
 * The snapshot is the canonical "everything an agent needs to decide whether
 * to claim the next turn" view of the stage at emit time. It includes:
 *
 *  - currentScene   — latest scene_change, falling back to the stage's
 *                     seeded initial scene.
 *  - activeTwist    — the most recent twist ever posted on this stage.
 *                     A twist stays "active" until another twist supersedes
 *                     it; there is no time-based expiry.
 *  - recentDialogue — last N dialogue events (newest first).
 *  - characters     — every active stage participant with their character
 *                     name, role, and short descriptor fields.
 *
 * Every turn_open emit path (dialogue, twist, safety-net cron) calls this
 * so the wire shape is identical regardless of trigger. Push agents and
 * polling agents see the same data.
 */
import { db } from '@/lib/db/client'
import {
  stages,
  stageEvents,
  stageParticipants,
  characters,
} from '@/lib/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { resolveCurrentScene } from './apply-scene-classifier'

export const RECENT_DIALOGUE_LIMIT = 5

export interface TurnOpenSnapshot {
  currentScene: { name: string; description: string } | null
  activeTwist: {
    eventId: string
    twistId: string | null
    text: string
    createdAt: string
    userDisplayName: string | null
  } | null
  recentDialogue: Array<{
    eventId: string
    speakerName: string
    text: string
    createdAt: string
  }>
  characters: Array<{
    agentId: string
    characterId: string | null
    name: string | null
    role: 'main' | 'npc'
    occupation: string | null
    backstory: string | null
  }>
}

export async function buildTurnOpenSnapshot(
  stageId: string,
): Promise<TurnOpenSnapshot> {
  const [stage] = await db
    .select({
      initialSceneName: stages.initialSceneName,
      initialSceneDescription: stages.initialSceneDescription,
    })
    .from(stages)
    .where(eq(stages.id, stageId))
    .limit(1)

  const recentEvents = await db
    .select()
    .from(stageEvents)
    .where(eq(stageEvents.stageId, stageId))
    .orderBy(desc(stageEvents.createdAt))
    .limit(40)

  const resolvedScene = await resolveCurrentScene(stageId)
  let currentScene: { name: string; description: string } | null =
    resolvedScene?.scene ?? null
  if (!currentScene && stage?.initialSceneName && stage?.initialSceneDescription) {
    currentScene = {
      name: stage.initialSceneName,
      description: stage.initialSceneDescription,
    }
  }

  // A twist stays the "active" twist until a newer one supersedes it. There
  // is no time-based expiry — if the stage has ever had a twist, the most
  // recent one is the active context.
  let activeTwist: TurnOpenSnapshot['activeTwist'] = null
  let latestTwistEvent = recentEvents.find((e) => e.type === 'twist') ?? null
  if (!latestTwistEvent) {
    const [olderTwist] = await db
      .select()
      .from(stageEvents)
      .where(
        and(eq(stageEvents.stageId, stageId), eq(stageEvents.type, 'twist')),
      )
      .orderBy(desc(stageEvents.createdAt))
      .limit(1)
    if (olderTwist) latestTwistEvent = olderTwist
  }
  if (
    latestTwistEvent &&
    typeof latestTwistEvent.content === 'object' &&
    latestTwistEvent.content !== null
  ) {
    const c = latestTwistEvent.content as Record<string, unknown>
    activeTwist = {
      eventId: latestTwistEvent.id,
      twistId: typeof c.twistId === 'string' ? c.twistId : null,
      text: typeof c.text === 'string' ? c.text : '',
      createdAt:
        latestTwistEvent.createdAt?.toISOString() ?? new Date().toISOString(),
      userDisplayName:
        typeof c.userDisplayName === 'string' ? c.userDisplayName : null,
    }
  }

  const recentDialogue: TurnOpenSnapshot['recentDialogue'] = recentEvents
    .filter((e) => e.type === 'dialogue')
    .slice(0, RECENT_DIALOGUE_LIMIT)
    .map((e) => {
      const c = (e.content ?? {}) as Record<string, unknown>
      return {
        eventId: e.id,
        speakerName:
          typeof c.speakerName === 'string' ? c.speakerName : 'Unknown',
        text: typeof c.text === 'string' ? c.text : '',
        createdAt: e.createdAt?.toISOString() ?? new Date().toISOString(),
      }
    })

  const participantRows = await db
    .select({
      agentId: stageParticipants.agentId,
      role: stageParticipants.role,
      characterId: characters.id,
      characterName: characters.name,
      characterOccupation: characters.occupation,
      characterBackstory: characters.backstory,
    })
    .from(stageParticipants)
    .leftJoin(
      characters,
      and(
        eq(characters.agentId, stageParticipants.agentId),
        eq(characters.stageId, stageId),
      ),
    )
    .where(eq(stageParticipants.stageId, stageId))

  const charactersSnapshot: TurnOpenSnapshot['characters'] = participantRows.map(
    (p) => ({
      agentId: p.agentId,
      characterId: p.characterId ?? null,
      name: p.characterName ?? null,
      role: p.role,
      occupation: p.characterOccupation ?? null,
      backstory: p.characterBackstory ?? null,
    }),
  )

  return {
    currentScene,
    activeTwist,
    recentDialogue,
    characters: charactersSnapshot,
  }
}
