/**
 * Compare scene classifier results across models on a curated sample from
 * scene-classifier-replay.csv (no DB writes).
 *
 * Usage:
 *   bunx tsx scripts/compare-scene-classifier-models.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { classifyScene } from '../lib/stage/scene-classifier'

const MODELS = [
  'openai/gpt-5-nano',
  'deepseek/deepseek-v4-flash',
] as const

/** Representative lines from the production replay CSV. */
const SAMPLE_EVENT_IDS = [
  '4843776a-788d-4985-96d3-a098ff57574b', // cantina — should stay
  '901de30b-3149-4324-b9cb-284e2cb028a1', // cantina entry — should stay
  '290be9d9-ca58-458a-9eaa-bf4edc67b383', // cantina corner table — debatable
  '676f9478-0662-43ba-8b8c-5293fff0f325', // Clawfather bedroom
  '3b2d064c-6f9f-4bfe-a86d-fd8879fa86af', // Clawfather hospital corridor
  'fa4f0369-2a00-4964-801a-2757e343e428', // Clawfather docks
  'b554f6f6-162c-4eb8-b384-5547ffd8427e', // Clawfather hospital ER
  'a76da354-71ba-4bff-9e7c-04ae3c100d6f', // walks back into study
  '3891b51e-67fa-42f8-ae31-53f0a10bfc7f', // Sicilian bakery
  'c7c841a5-1685-46fa-a142-763a52999088', // Claw Wars asteroid bay
  '31ec57cb-e32d-4aa4-bc3c-d908faafbd08', // Claw Wars listening post
]

const STAGE_THEMES: Record<string, string> = {
  'Claw Wars': 'scifi',
  'The Clawfather': 'drama',
  'Claw of the Titans': 'mythology',
}

type ReplayRow = {
  stage_name: string
  event_id: string
  event_type: string
  speaker: string
  line_text: string
  triggered_keywords: string
  scene_changed: string
  new_scene_name: string
  current_scene_name_before: string
  current_scene_description_before: string
}

function parseCsv(text: string): ReplayRow[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') inQ = false
      else field += c
    } else if (c === '"') inQ = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  const header = rows[0]
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {}
    header.forEach((h, i) => {
      obj[h] = r[i] ?? ''
    })
    return obj as ReplayRow
  })
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

async function classifyWithModel(
  row: ReplayRow,
  model: string,
): Promise<{
  changed: boolean
  name: string
  description: string
  ms: number
}> {
  const prev = process.env.OPENROUTER_SCENE_MODEL
  process.env.OPENROUTER_SCENE_MODEL = model
  const t0 = Date.now()
  try {
    const result = await classifyScene({
      stageName: row.stage_name,
      stageTheme: STAGE_THEMES[row.stage_name] ?? 'drama',
      currentScene: {
        name: row.current_scene_name_before,
        description: row.current_scene_description_before,
      },
      newEvent: {
        kind: row.event_type === 'twist' ? 'twist' : 'dialogue',
        speaker: row.speaker || undefined,
        text: row.line_text,
      },
    })
    const ms = Date.now() - t0
    if (result.changed) {
      return {
        changed: true,
        name: result.name,
        description: result.description,
        ms,
      }
    }
    return { changed: false, name: '', description: '', ms }
  } finally {
    if (prev === undefined) delete process.env.OPENROUTER_SCENE_MODEL
    else process.env.OPENROUTER_SCENE_MODEL = prev
  }
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY required')
  }

  const replayPath = path.resolve('scene-classifier-replay.csv')
  const allRows = parseCsv(fs.readFileSync(replayPath, 'utf8'))
  const sample = SAMPLE_EVENT_IDS.map((id) => {
    const row = allRows.find((r) => r.event_id === id)
    if (!row) throw new Error(`Missing replay row for ${id}`)
    return row
  })

  const outPath = path.resolve('scene-classifier-model-comparison.csv')
  const header = [
    'stage_name',
    'event_id',
    'speaker',
    'triggered_keywords',
    'replay_gpt5_nano_changed',
    'replay_gpt5_nano_scene',
    'line_text_excerpt',
    'current_scene_before',
    'gpt5_nano_changed',
    'gpt5_nano_scene_name',
    'gpt5_nano_ms',
    'deepseek_flash_changed',
    'deepseek_flash_scene_name',
    'deepseek_flash_ms',
    'models_agree',
  ]
  fs.writeFileSync(outPath, header.join(',') + '\n', 'utf8')

  console.log(`Comparing ${sample.length} lines across ${MODELS.join(' vs ')}…`)

  for (const row of sample) {
    const nano = await classifyWithModel(row, 'openai/gpt-5-nano')
    await new Promise((r) => setTimeout(r, 200))
    const flash = await classifyWithModel(row, 'deepseek/deepseek-v4-flash')

    const line = [
      row.stage_name,
      row.event_id,
      row.speaker,
      row.triggered_keywords,
      row.scene_changed,
      row.new_scene_name,
      row.line_text.slice(0, 200),
      row.current_scene_name_before,
      nano.changed ? 'yes' : 'no',
      nano.name,
      String(nano.ms),
      flash.changed ? 'yes' : 'no',
      flash.name,
      String(flash.ms),
      nano.changed === flash.changed ? 'yes' : 'no',
    ]
      .map((v) => csvEscape(v))
      .join(',')

    fs.appendFileSync(outPath, line + '\n', 'utf8')
    console.log(
      `  ${row.event_id.slice(0, 8)}… nano=${nano.changed ? 'yes' : 'no'} flash=${flash.changed ? 'yes' : 'no'} (${nano.ms}ms / ${flash.ms}ms)`,
    )
  }

  console.log(`\nWrote ${outPath}`)
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
