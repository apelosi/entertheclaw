/**
 * Server-side scene classifier.
 *
 * After a new dialogue or twist is inserted, a cheap signal gate decides
 * whether an OpenRouter call is worth making. Routine in-character lines and
 * non-relocating twists keep the current scene from the DB without an LLM
 * round-trip. When the gate passes, a small model decides if the line
 * meaningfully moves the scene (location / context shift). If yes, return the
 * new scene's name + description so the API route can append a `scene_change`
 * stage event.
 *
 * Fails silent: any error / timeout returns { changed: false }. The platform
 * keeps running on the current scene; a future event gets another chance.
 */

import { shouldRunSceneClassifier } from './scene-change-signals'
import { scenesAreSameLocation } from './scene-same-location'
import {
  buildSceneFallbackFromTwistText,
  twistExplicitlyRelocatesScene,
} from './twist-scene-fallback'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash'
const REASONING_MODEL_PREFIXES = ['openai/gpt-5', 'openai/o']
const DIALOGUE_TIMEOUT_MS = 12_000
const TWIST_TIMEOUT_MS = 12_000

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

After a new line of in-character dialogue, decide ONE thing: does the action move to a genuinely DIFFERENT physical location than CURRENT SCENE, or stay?

You are always given CURRENT SCENE name (and description). Compare the NEW LINE against that name first.

A "scene" is a specific place and what's happening there right now (time of day, who's physically present, immediate activity).

CHANGE (respond changed:true) ONLY when:
- The action is NOW at a physical location you would NOT already be in given CURRENT SCENE name.
- A hard cut or time skip lands characters in a new place NOW.
- The speaker clearly travels and arrives somewhere new in this beat (not merely planning to go).

STAY (respond changed:false) when:
- CURRENT SCENE name already describes where the action is, even if the NEW LINE rephrases it, updates the camera, adds detail, or uses different words for the same spot ("fifty meters east of the cantina" when already at the collapsed vent grate by the cantina ruins).
- In-character speech only, with no new physical setting established for THIS beat.
- Past tense, future plans, or mentioning another place without relocating the dramatic focus.
- Small movements within the current location (window, door, desk, chair).
- A bracket restates or embellishes the same location — not a new one.

Important: Agents write [bracketed stage directions]. Brackets establish location only when they move to somewhere different from CURRENT SCENE name.

When changing, write:
- name: 6–10 words, concrete location + brief context (e.g. "Hospital corridor outside room 214" / "Bellante Imports warehouse, night").
- description: 1–3 sentences, present tense, paint the space and what's immediately happening. No dialogue, no character interiority.
- reason: 1 short sentence explaining WHY this line changed the scene.

Output strict JSON:
{ "changed": false }
OR
{ "changed": true, "name": "...", "description": "...", "reason": "..." }

No prose outside the JSON object.`

const TWIST_SYSTEM_PROMPT = `You are the silent stage director for a 24/7 improv platform.

A human director just injected a TWIST — authoritative stage direction, not in-character dialogue.

Decide whether the twist relocates the action to a genuinely DIFFERENT physical location than CURRENT SCENE name.

Rules:
- Compare against CURRENT SCENE name first. changed:false if the twist only rephrases or embellishes the same location.
- Director twists that describe travel, hard cuts, explosions pulling people outside, "scene changes to…", or a new setting MUST emit changed:true when the place is truly different.
- DO NOT stay on the current scene when the director explicitly moves the action elsewhere.
- DO NOT change scene for purely emotional or relational beats with no location shift.
- When changing, write:
  - name: 6–10 words, concrete location + brief context.
  - description: 1–3 sentences, present tense, paint the space and what's immediately happening. No dialogue.
  - reason: 1 short sentence explaining why this twist changed the scene.

Output strict JSON:
{ "changed": false }
OR
{ "changed": true, "name": "...", "description": "...", "reason": "..." }

No prose outside the JSON object.`

const TWIST_EXTRACTION_PROMPT = `You are the silent stage director for a 24/7 improv platform.

The director twist below explicitly relocates the scene. Extract the NEW scene location and context.

Always respond with changed:true. Write:
- name: 6–10 words, concrete location + brief context.
- description: 1–3 sentences, present tense, paint the space and what's immediately happening. No dialogue.
- reason: 1 short sentence.

Output strict JSON:
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

Compare against CURRENT SCENE name "${input.currentScene.name}". changed:true only if physically elsewhere.`
}

function suppressDuplicateSceneChange(
  currentScene: { name: string; description: string },
  result: SceneClassifierResult,
): SceneClassifierResult {
  if (!result.changed) return result
  if (scenesAreSameLocation(currentScene.name, result.name)) {
    return { changed: false }
  }
  return result
}

function normalizeChangedResult(
  parsed: unknown,
): Extract<SceneClassifierResult, { changed: true }> | { changed: false } {
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
    reason: reason.slice(0, 280) || 'Scene relocated.',
  }
}

async function callSceneClassifierModel(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number,
): Promise<SceneClassifierResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

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
        ...(REASONING_MODEL_PREFIXES.some((p) => model.startsWith(p))
          ? { reasoning: { effort: 'minimal' as const } }
          : {}),
        temperature: 0.4,
        max_tokens: 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
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

    const normalized = normalizeChangedResult(parsed)
    if (normalized.changed) {
      return {
        ...normalized,
        reason: normalized.reason.slice(0, 280) || 'Scene relocated.',
      }
    }
    return { changed: false }
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      console.warn('[scene-classifier] timed out after', timeoutMs, 'ms')
    } else {
      console.warn('[scene-classifier] error:', err)
    }
    return { changed: false }
  } finally {
    clearTimeout(timeoutId)
  }
}

function twistSceneFallback(text: string): SceneClassifierResult {
  const fallback = buildSceneFallbackFromTwistText(text)
  if (fallback) {
    console.warn(
      '[scene-classifier] using deterministic twist relocation fallback',
    )
    return fallback
  }
  return { changed: false }
}

export async function classifyScene(
  input: SceneClassifierInput,
): Promise<SceneClassifierResult> {
  const isTwist = input.newEvent.kind === 'twist'
  const text = input.newEvent.text
  const explicitRelocation = isTwist && twistExplicitlyRelocatesScene(text)

  // Explicit director relocations are handled deterministically — no LLM.
  if (explicitRelocation) {
    const fallback = buildSceneFallbackFromTwistText(text)
    if (fallback) {
      return suppressDuplicateSceneChange(input.currentScene, fallback)
    }
  }

  // Routine dialogue and non-relocating twists keep the DB-resolved scene.
  if (!shouldRunSceneClassifier(input.newEvent.kind, text)) {
    return { changed: false }
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    if (explicitRelocation) {
      return twistSceneFallback(text)
    }
    console.warn('[scene-classifier] OPENROUTER_API_KEY not set; skipping')
    return { changed: false }
  }

  const model = process.env.OPENROUTER_SCENE_MODEL || DEFAULT_MODEL
  const timeoutMs = isTwist ? TWIST_TIMEOUT_MS : DIALOGUE_TIMEOUT_MS
  const systemPrompt = isTwist ? TWIST_SYSTEM_PROMPT : SYSTEM_PROMPT
  const userPrompt = buildUserPrompt(input)

  const primary = await callSceneClassifierModel(
    apiKey,
    model,
    systemPrompt,
    userPrompt,
    timeoutMs,
  )
  if (primary.changed) {
    return suppressDuplicateSceneChange(input.currentScene, primary)
  }

  if (explicitRelocation) {
    const extraction = await callSceneClassifierModel(
      apiKey,
      model,
      TWIST_EXTRACTION_PROMPT,
      userPrompt,
      timeoutMs,
    )
    if (extraction.changed) {
      return suppressDuplicateSceneChange(input.currentScene, extraction)
    }
    return suppressDuplicateSceneChange(
      input.currentScene,
      twistSceneFallback(text),
    )
  }

  return { changed: false }
}
