/**
 * Server-side scene classifier.
 *
 * After a new dialogue or twist is inserted, ask a cheap OpenRouter model
 * whether the line meaningfully moves the scene (location / context shift).
 * If yes, return the new scene's name + description so the API route can
 * append a `scene_change` stage event.
 *
 * Fails silent: any error / timeout returns { changed: false }. The platform
 * keeps running on the current scene; a future event gets another chance.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = 'openai/gpt-5-nano'
const TIMEOUT_MS = 4000

export interface SceneClassifierInput {
  stageName: string
  stageTheme: string
  currentScene: { name: string; description: string }
  newEvent: {
    kind: 'dialogue' | 'twist'
    speaker?: string
    text: string
  }
}

export type SceneClassifierResult =
  | { changed: false }
  | { changed: true; name: string; description: string; reason: string }

const SYSTEM_PROMPT = `You are the silent stage director for a 24/7 improv platform.

After every new line of dialogue or every twist injected by a human director, you decide ONE thing: does the action move to a new scene, or stay where it is?

Rules:
- A "scene" is a location + immediate context (time of day, who's present in the room, what's happening around them).
- DO NOT change scene for: in-character chatter, internal feelings, declared intentions ("I'll go to work later"), small movements within the same space, jokes, or anything ambiguous. Bias hard toward staying.
- DO change scene for: explicit travel, hard cuts to a new place, off-stage events that pull focus elsewhere (an explosion outside, a phone call dragging us to a new room), or twists that materially relocate the action.
- A scene change is a story beat. Use it sparingly — at most one per several lines.
- When changing, write:
  - name: 6–10 words, concrete location + brief context (e.g. "Arthur's kitchen, dawn" / "Highway shoulder at the wreck").
  - description: 1–3 sentences, present tense, paint the room/space and what's immediately happening. No dialogue, no character interiority.
  - reason: 1 short sentence explaining WHY this line changed the scene.

Output strict JSON of the shape:
{ "changed": false }
OR
{ "changed": true, "name": "...", "description": "...", "reason": "..." }

No prose outside the JSON object.`

function buildUserPrompt(input: SceneClassifierInput): string {
  const speaker = input.newEvent.speaker ? ` (${input.newEvent.speaker})` : ''
  const eventLabel = input.newEvent.kind === 'twist' ? 'NEW TWIST' : 'NEW LINE'
  return `Stage: "${input.stageName}" (${input.stageTheme})

CURRENT SCENE
name: ${input.currentScene.name}
description: ${input.currentScene.description}

${eventLabel}${speaker}: ${input.newEvent.text}

Decide.`
}

export async function classifyScene(
  input: SceneClassifierInput,
): Promise<SceneClassifierResult> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    console.warn('[scene-classifier] OPENROUTER_API_KEY not set; skipping')
    return { changed: false }
  }

  const model = process.env.OPENROUTER_SCENE_MODEL || DEFAULT_MODEL

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://entertheclaw.com',
        'X-Title': 'Enter The Claw - scene classifier',
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 400,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(input) },
        ],
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn(
        `[scene-classifier] HTTP ${res.status}: ${body.slice(0, 200)}`,
      )
      return { changed: false }
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const raw = json.choices?.[0]?.message?.content
    if (typeof raw !== 'string') return { changed: false }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      console.warn('[scene-classifier] non-JSON response:', raw.slice(0, 200))
      return { changed: false }
    }

    if (!parsed || typeof parsed !== 'object') return { changed: false }
    const p = parsed as Record<string, unknown>

    if (p.changed !== true) return { changed: false }

    const name = typeof p.name === 'string' ? p.name.trim() : ''
    const description =
      typeof p.description === 'string' ? p.description.trim() : ''
    const reason = typeof p.reason === 'string' ? p.reason.trim() : ''
    if (!name || !description) return { changed: false }

    return {
      changed: true,
      name: name.slice(0, 120),
      description: description.slice(0, 800),
      reason: reason.slice(0, 280),
    }
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      console.warn('[scene-classifier] timed out after', TIMEOUT_MS, 'ms')
    } else {
      console.warn('[scene-classifier] error:', err)
    }
    return { changed: false }
  } finally {
    clearTimeout(timeoutId)
  }
}
