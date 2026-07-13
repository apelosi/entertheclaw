/**
 * Replay production script history through the keyword gate + scene classifier.
 * Does NOT write to the database. Outputs a CSV for human review.
 *
 * Usage:
 *   bunx tsx scripts/simulate-scene-classifier-history.ts
 *   bunx tsx scripts/simulate-scene-classifier-history.ts --out=scene-classifier-replay.csv
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { classifyScene } from '../lib/stage/scene-classifier'
import {
  getMatchingRelocationSignals,
  shouldRunSceneClassifier,
} from '../lib/stage/scene-change-signals'

const BASE = 'https://entertheclaw.com/api/v1'

type StageMeta = {
  id: string
  name: string
  theme: string
  initialSceneName: string | null
  initialSceneDescription: string | null
}

type FeedEvent = {
  id: string
  type: 'dialogue' | 'twist' | 'scene_change' | string
  content: Record<string, unknown>
  createdAt: string
}

type CurrentScene = { name: string; description: string }

type CsvRow = {
  stageName: string
  stageId: string
  eventId: string
  eventType: string
  createdAt: string
  speaker: string
  lineText: string
  triggeredKeywords: string
  classifierCalled: string
  sceneChanged: string
  newSceneName: string
  newSceneDescription: string
  currentSceneNameBefore: string
  currentSceneDescriptionBefore: string
}

function readOutPath(): string {
  const arg = process.argv.find((a) => a.startsWith('--out='))
  return arg
    ? arg.slice('--out='.length)
    : 'scene-classifier-replay.csv'
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

async function fetchStages(): Promise<StageMeta[]> {
  const res = await fetch(`${BASE}/stages`)
  if (!res.ok) throw new Error(`stages HTTP ${res.status}`)
  const json = (await res.json()) as { stages: StageMeta[] }
  return json.stages
}

async function fetchFeedTotal(stageId: string): Promise<number> {
  const res = await fetch(
    `${BASE}/stages/${stageId}/feed?limit=1&types=dialogue,twist,scene_change`,
  )
  const json = (await res.json()) as { total?: number }
  return json.total ?? 0
}

async function fetchAllScriptEvents(stageId: string): Promise<FeedEvent[]> {
  const all: FeedEvent[] = []
  let before: string | null = null
  for (;;) {
    const url = new URL(`${BASE}/stages/${stageId}/feed`)
    url.searchParams.set('limit', '100')
    url.searchParams.set('types', 'dialogue,twist,scene_change')
    if (before) url.searchParams.set('before', before)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`feed HTTP ${res.status} for ${stageId}`)
    const json = (await res.json()) as {
      events: FeedEvent[]
      nextCursor: string | null
      hasMore: boolean
    }
    all.push(...json.events)
    if (!json.hasMore || !json.nextCursor) break
    before = json.nextCursor
  }
  return all.reverse()
}

function eventText(event: FeedEvent): string {
  return String(event.content.text ?? '').trim()
}

function eventSpeaker(event: FeedEvent): string {
  return String(
    event.content.speakerName ?? event.content.userDisplayName ?? '',
  ).trim()
}

function applySceneChangeContent(
  scene: CurrentScene,
  content: Record<string, unknown>,
): CurrentScene {
  const name = typeof content.name === 'string' ? content.name.trim() : ''
  const description =
    typeof content.description === 'string' ? content.description.trim() : ''
  if (name && description) return { name, description }
  return scene
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is required for classifier replay')
  }

  const outPath = path.resolve(readOutPath())
  const header = [
    'stage_name',
    'stage_id',
    'event_id',
    'event_type',
    'created_at',
    'speaker',
    'line_text',
    'triggered_keywords',
    'classifier_called',
    'scene_changed',
    'new_scene_name',
    'new_scene_description',
    'current_scene_name_before',
    'current_scene_description_before',
  ]
  fs.writeFileSync(outPath, header.join(',') + '\n', 'utf8')

  const appendRow = (row: CsvRow) => {
    const line = [
      row.stageName,
      row.stageId,
      row.eventId,
      row.eventType,
      row.createdAt,
      row.speaker,
      row.lineText,
      row.triggeredKeywords,
      row.classifierCalled,
      row.sceneChanged,
      row.newSceneName,
      row.newSceneDescription,
      row.currentSceneNameBefore,
      row.currentSceneDescriptionBefore,
    ]
      .map((v) => csvEscape(v))
      .join(',')
    fs.appendFileSync(outPath, line + '\n', 'utf8')
  }

  const stages = await fetchStages()
  const active = []
  for (const stage of stages) {
    const total = await fetchFeedTotal(stage.id)
    if (total > 1) active.push({ stage, total })
  }

  console.log(
    `Stages with script history: ${active.map((s) => `${s.stage.name} (${s.total})`).join(', ')}`,
  )

  const rows: CsvRow[] = []
  let classifierCalls = 0

  for (const { stage, total } of active) {
    console.log(`\nReplaying ${stage.name} (${total} events)…`)
    const events = await fetchAllScriptEvents(stage.id)
    let currentScene: CurrentScene = {
      name: stage.initialSceneName ?? 'The stage',
      description: stage.initialSceneDescription ?? '',
    }

    for (const event of events) {
      if (event.type === 'scene_change') {
        currentScene = applySceneChangeContent(currentScene, event.content)
        continue
      }
      if (event.type !== 'dialogue' && event.type !== 'twist') continue

      const kind = event.type
      const text = eventText(event)
      if (!text) continue

      const keywords = getMatchingRelocationSignals(kind, text)
      const sceneBefore = { ...currentScene }
      const shouldCall = shouldRunSceneClassifier(kind, text, sceneBefore.name)
      if (!shouldCall) continue

      let result: Awaited<ReturnType<typeof classifyScene>> = { changed: false }

      result = await classifyScene({
        stageName: stage.name,
        stageTheme: stage.theme,
        currentScene: sceneBefore,
        newEvent: {
          kind,
          speaker: eventSpeaker(event) || undefined,
          text,
        },
      })
      classifierCalls += 1

      if (result.changed) {
        currentScene = {
          name: result.name,
          description: result.description,
        }
      }

      rows.push({
        stageName: stage.name,
        stageId: stage.id,
        eventId: event.id,
        eventType: kind,
        createdAt: event.createdAt,
        speaker: eventSpeaker(event),
        lineText: text,
        triggeredKeywords: keywords.join('|'),
        classifierCalled: 'yes',
        sceneChanged: result.changed ? 'yes' : 'no',
        newSceneName: result.changed ? result.name : '',
        newSceneDescription: result.changed ? result.description : '',
        currentSceneNameBefore: sceneBefore.name,
        currentSceneDescriptionBefore: sceneBefore.description,
      })
      appendRow(rows[rows.length - 1]!)

      if (classifierCalls % 10 === 0) {
        console.log(`  classifier calls so far: ${classifierCalls}`)
      }

      // Gentle rate limit for OpenRouter
      await sleep(250)
    }
  }

  console.log(`\nWrote ${rows.length} rows (${classifierCalls} classifier calls) to ${outPath}`)
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
