/**
 * Resolve the current scene for a stage, run the classifier against a new
 * event, and append a `scene_change` stage_event when the classifier says so.
 *
 * Intended to be called from the dialogue and twist POST routes after the
 * source event has already been inserted. Best-effort: any failure logs and
 * returns null so the parent request never fails because of scene logic.
 */
import { db } from '@/lib/db/client'
import { stages, stageEvents } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { classifyScene } from './scene-classifier'

interface ApplyInput {
  stageId: string
  sourceEvent: {
    id: string
    kind: 'dialogue' | 'twist'
    speaker?: string
    text: string
  }
}

export interface CurrentScene {
  name: string
  description: string
}

export async function resolveCurrentScene(
  stageId: string,
): Promise<{ stageName: string; stageTheme: string; scene: CurrentScene } | null> {
  const [stage] = await db
    .select({
      name: stages.name,
      theme: stages.theme,
      initialSceneName: stages.initialSceneName,
      initialSceneDescription: stages.initialSceneDescription,
    })
    .from(stages)
    .where(eq(stages.id, stageId))
    .limit(1)
  if (!stage) return null

  const [latestScene] = await db
    .select({ content: stageEvents.content })
    .from(stageEvents)
    .where(
      and(eq(stageEvents.stageId, stageId), eq(stageEvents.type, 'scene_change')),
    )
    .orderBy(desc(stageEvents.createdAt))
    .limit(1)

  let scene: CurrentScene = {
    name: stage.initialSceneName ?? 'The stage',
    description: stage.initialSceneDescription ?? '',
  }

  if (latestScene?.content && typeof latestScene.content === 'object') {
    const c = latestScene.content as Record<string, unknown>
    if (typeof c.name === 'string' && typeof c.description === 'string') {
      scene = { name: c.name, description: c.description }
    }
  }

  return { stageName: stage.name, stageTheme: stage.theme, scene }
}

export async function applySceneClassifier(input: ApplyInput): Promise<void> {
  try {
    const resolved = await resolveCurrentScene(input.stageId)
    if (!resolved) return

    const result = await classifyScene({
      stageName: resolved.stageName,
      stageTheme: resolved.stageTheme,
      currentScene: resolved.scene,
      newEvent: {
        kind: input.sourceEvent.kind,
        speaker: input.sourceEvent.speaker,
        text: input.sourceEvent.text,
      },
    })

    if (!result.changed) return

    await db.insert(stageEvents).values({
      stageId: input.stageId,
      type: 'scene_change',
      content: {
        name: result.name,
        description: result.description,
        reason: result.reason,
        sourceEventId: input.sourceEvent.id,
        sourceType: input.sourceEvent.kind,
      },
    })
  } catch (err) {
    console.warn('[apply-scene-classifier] failed:', err)
  }
}
