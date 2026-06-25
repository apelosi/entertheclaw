/**
 * Rolling per-character memory.
 *
 * Each character carries a compact, first-person summary of the story so far —
 * where they stand with everyone else, open threads, their current goal. It is
 * refreshed only every few witnessed lines (not every line), so it costs ~one
 * cheap model call per THRESHOLD lines per character, and it is always included
 * in the agent's prompt for cheap continuity (no growing context).
 *
 * Witness scoping is inherent: a character only ever folds in events from a
 * stage they are on, created at/after they joined. v1 memory is per-stage.
 *
 * Best-effort, like the scene classifier (lib/stage/scene-classifier.ts): any
 * error/timeout/missing key logs and returns; the platform keeps running and a
 * later line gets another chance.
 */
import { db } from '@/lib/db/client'
import { characters, stageEvents, stageParticipants, stages } from '@/lib/db/schema'
import { and, asc, eq, inArray } from 'drizzle-orm'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
// A cheap NON-reasoning model: it must emit prose. Reasoning models like
// gpt-5-nano spend their whole token budget thinking and return empty content,
// so we deliberately do NOT fall back to OPENROUTER_SCENE_MODEL here.
const DEFAULT_MODEL = 'openai/gpt-4o-mini'
const TIMEOUT_MS = 10000

/** Refresh once this many new witnessed lines have accrued since the last summary. */
const THRESHOLD = 8
/** Cap how many recent events we pull/fold per refresh. */
const WINDOW = 80
/** Cap stored memory length. */
const MAX_MEMORY_CHARS = 2000

const SCRIPT_TYPES = ['dialogue', 'twist', 'scene_change'] as const

const SYSTEM_PROMPT = `You maintain a private running memory for ONE character in an ongoing, never-ending improv drama.

You are given: the character's identity, their PREVIOUS memory (may be empty), and the NEW events they personally witnessed since then.

Write their UPDATED memory as a tight first-person note (~120-160 words). Capture only what helps them act in character next:
- the through-line of what has happened so far,
- where they now stand with each other character by name (ally, rival, romance on/off, debt, secret, grudge),
- unresolved threads and promises,
- their current goal or intention.

Fold the new events into the previous memory; drop stale detail so it stays compact. Concrete and specific over vague. First person ("I"). Output ONLY the memory text — no headers, no preamble.`

interface CharacterRow {
  id: string
  name: string | null
  occupation: string | null
  goals: string | null
  relationships: Record<string, string> | null
  memory: string | null
  memoryCursorEventId: string | null
  joinedAt: Date | null
}

interface ScriptEvent {
  id: string
  type: string
  content: unknown
  createdAt: Date | null
}

function eventToLine(e: ScriptEvent): string | null {
  const c = (e.content ?? {}) as Record<string, unknown>
  if (e.type === 'dialogue') {
    const who = typeof c.speakerName === 'string' ? c.speakerName : 'Someone'
    const text = typeof c.text === 'string' ? c.text : ''
    return text ? `${who}: ${text}` : null
  }
  if (e.type === 'twist') {
    const text = typeof c.text === 'string' ? c.text : ''
    return text ? `[TWIST] ${text}` : null
  }
  if (e.type === 'scene_change') {
    const name = typeof c.name === 'string' ? c.name : ''
    const desc = typeof c.description === 'string' ? c.description : ''
    return name || desc ? `[SCENE] ${name}${desc ? ` — ${desc}` : ''}` : null
  }
  return null
}

function buildUserPrompt(ch: CharacterRow, lines: string[]): string {
  const rel =
    ch.relationships && Object.keys(ch.relationships).length
      ? Object.entries(ch.relationships)
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ')
      : ''
  return [
    `CHARACTER: ${ch.name ?? 'Unknown'}${ch.occupation ? ` (${ch.occupation})` : ''}`,
    ch.goals ? `GOAL: ${ch.goals}` : '',
    rel ? `KNOWN RELATIONSHIPS: ${rel}` : '',
    '',
    `PREVIOUS MEMORY:\n${ch.memory?.trim() || '(none yet — this is the start)'}`,
    '',
    `NEW EVENTS WITNESSED (oldest first):\n${lines.join('\n')}`,
    '',
    'Write the updated memory.',
  ]
    .filter(Boolean)
    .join('\n')
}

async function summarize(
  apiKey: string,
  model: string,
  ch: CharacterRow,
  lines: string[],
): Promise<string | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://entertheclaw.com',
        'X-Title': 'Enter The Claw - character memory',
      },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        max_tokens: 400,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(ch, lines) },
        ],
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn(`[character-memory] HTTP ${res.status}: ${body.slice(0, 200)}`)
      return null
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const raw = json.choices?.[0]?.message?.content
    const text = typeof raw === 'string' ? raw.trim() : ''
    return text ? text.slice(0, MAX_MEMORY_CHARS) : null
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      console.warn('[character-memory] timed out')
    } else {
      console.warn('[character-memory] error:', err)
    }
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * For every character on the stage, fold any newly-witnessed lines into their
 * rolling memory when enough have accrued. Fire-and-forget; never throws.
 */
export async function refreshCharacterMemoriesIfStale(
  stageId: string,
): Promise<void> {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) return // no model configured — leave memory untouched
    const model = process.env.OPENROUTER_MEMORY_MODEL || DEFAULT_MODEL

    // Characters on this stage + when each joined (witness floor).
    const rows: CharacterRow[] = await db
      .select({
        id: characters.id,
        name: characters.name,
        occupation: characters.occupation,
        goals: characters.goals,
        relationships: characters.relationships,
        memory: characters.memory,
        memoryCursorEventId: characters.memoryCursorEventId,
        joinedAt: stageParticipants.joinedAt,
      })
      .from(characters)
      .innerJoin(
        stageParticipants,
        and(
          eq(stageParticipants.stageId, characters.stageId),
          eq(stageParticipants.agentId, characters.agentId),
        ),
      )
      .where(eq(characters.stageId, stageId))

    if (rows.length === 0) return

    // Recent script events on the stage, oldest-first, capped.
    const recent: ScriptEvent[] = await db
      .select({
        id: stageEvents.id,
        type: stageEvents.type,
        content: stageEvents.content,
        createdAt: stageEvents.createdAt,
      })
      .from(stageEvents)
      .where(
        and(
          eq(stageEvents.stageId, stageId),
          inArray(stageEvents.type, [...SCRIPT_TYPES]),
        ),
      )
      .orderBy(asc(stageEvents.createdAt))
      .limit(WINDOW)

    // Process characters concurrently: this whole function runs fire-and-forget
    // after the dialogue response, so a sequential loop of multi-second model
    // calls could be cut off before the later characters are reached. One LLM
    // call per character that crossed the threshold; failures are isolated.
    await Promise.allSettled(
      rows.map((ch) =>
        refreshOne(apiKey, model, ch, recent).catch((err) => {
          console.warn(`[character-memory] character ${ch.id} failed:`, err)
        }),
      ),
    )
  } catch (err) {
    console.warn('[character-memory] refresh failed:', err)
  }
}

/**
 * Soft wall-clock budget for one sweep. The sweep runs inside the turn-open-tick
 * cron route, which is a synchronous serverless function with a hard platform
 * timeout. We stop starting new stages once this elapses so a large backfill
 * can't get the whole tick killed; the rest is picked up on the next tick
 * (self-healing — unsummarized characters keep a null cursor and get retried).
 */
const SWEEP_BUDGET_MS = 8000

/**
 * Sweep active stages and refresh any stale character memories. This is the
 * RELIABLE population path: the per-line fire-and-forget call may be cut off
 * after the dialogue response returns on serverless, so a periodic server-side
 * sweep (driven by the turn-open-tick cron) is what actually keeps memory
 * current — and backfills existing stages over its first runs. Gated and
 * self-healing: characters below the line threshold are skipped, so steady
 * state is cheap; only stale characters incur a model call.
 */
export async function refreshActiveStageMemories(): Promise<{
  scanned: number
  processed: number
}> {
  try {
    const active = await db
      .select({ id: stages.id })
      .from(stages)
      .where(eq(stages.isActive, true))
    const deadline = Date.now() + SWEEP_BUDGET_MS
    let processed = 0
    // Sequential across stages bounds concurrency (each stage already refreshes
    // its own characters in parallel internally). Stop launching new stages once
    // the budget is spent; the next tick continues from the remaining stages.
    for (const s of active) {
      if (Date.now() >= deadline) break
      await refreshCharacterMemoriesIfStale(s.id)
      processed += 1
    }
    return { scanned: active.length, processed }
  } catch (err) {
    console.warn('[character-memory] active-stage sweep failed:', err)
    return { scanned: 0, processed: 0 }
  }
}

async function refreshOne(
  apiKey: string,
  model: string,
  ch: CharacterRow,
  recent: ScriptEvent[],
): Promise<void> {
  // Cutoff: the cursor event's timestamp if we have one, else the join time.
  const cursorEvent = ch.memoryCursorEventId
    ? recent.find((e) => e.id === ch.memoryCursorEventId)
    : undefined
  const cutoff = cursorEvent?.createdAt ?? ch.joinedAt ?? null

  const fresh = recent.filter((e) => {
    if (!e.createdAt) return false
    if (ch.joinedAt && e.createdAt < ch.joinedAt) return false // didn't witness
    if (cutoff && e.createdAt <= cutoff) return false // already folded in
    return true
  })

  if (fresh.length < THRESHOLD) return

  const lines = fresh.map(eventToLine).filter((l): l is string => l !== null)
  if (lines.length < THRESHOLD) return

  const summary = await summarize(apiKey, model, ch, lines)
  if (!summary) return

  const lastId = fresh[fresh.length - 1].id
  await db
    .update(characters)
    .set({
      memory: summary,
      memoryCursorEventId: lastId,
      memoryUpdatedAt: new Date(),
    })
    .where(eq(characters.id, ch.id))
}
