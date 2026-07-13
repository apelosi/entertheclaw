/**
 * Server-side scene classifier.
 *
 * After a new dialogue or twist is inserted, a cheap signal gate decides
 * whether an OpenRouter call is worth making. The gate uses CURRENT SCENE name
 * so bracket staging at the same spot never burns tokens. When the gate passes,
 * a small model decides if the line meaningfully moves the scene. Invariants
 * after the LLM reject self-contradictory changed:true (same name, reason says
 * stay).
 *
 * Fails silent: any error / timeout returns { changed: false }.
 */

import { shouldRunSceneClassifier } from './scene-change-signals'
import { sceneNamesEqual } from './scene-name'
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

You are given CURRENT SCENE (name + description) and a NEW LINE of in-character dialogue.

Your job is a single yes/no decision:
Does the dramatic action NOW take place at a DIFFERENT physical location than CURRENT SCENE name?

Decision rules (read in order):
1. Compare NEW LINE against CURRENT SCENE name first — not against the description alone.
2. If CURRENT SCENE name already covers where the action is, answer changed:false. This includes rephrasing, camera refresh, added detail, or micro-movement within the same spot.
3. NEVER answer changed:true if your proposed name would be the same as CURRENT SCENE name (word for word or equivalent).
4. Answer changed:true ONLY when characters are physically somewhere you would NOT already be in given CURRENT SCENE name — hard cut, arrival, or a bracket that establishes a genuinely new place.

Examples of changed:false:
- CURRENT "Collapsed vent grate at the edge of the cantina ruins" + line "[steps toward the pulsing grate]" → same grate, changed:false
- CURRENT "Outside the cantina" + line mentions hospital in speech but action stays outside → changed:false

Examples of changed:true:
- CURRENT "Outside the cantina" + bracket establishes hospital corridor where Luca now stands → changed:true
- CURRENT "Don Corleone's study" + "Cut to the hospital corridor" → changed:true

When changed:true, also write:
- name: 6–10 words, concrete location + brief context (must differ from CURRENT SCENE name).
- description: 1–3 sentences, present tense. No dialogue.
- reason: 1 short sentence explaining the relocation (must NOT say the location stayed the same).

Output strict JSON — nothing else:
{ "changed": false }
OR
{ "changed": true, "name": "...", "description": "...", "reason": "..." }`

const TWIST_SYSTEM_PROMPT = `You are the silent stage director for a 24/7 improv platform.

A human director injected a TWIST (authoritative stage direction).

Decide: does the twist relocate the action to a DIFFERENT physical location than CURRENT SCENE name?

Rules:
1. Compare against CURRENT SCENE name first.
2. changed:false if the twist only rephrases, embellishes, or adds action at the same place.
3. NEVER changed:true with the same name as CURRENT SCENE.
4. changed:true when the director explicitly moves the action elsewhere (travel, cut, explosion forcing exit, "scene changes to…").

When changed:true:
- name: 6–10 words, must differ from CURRENT SCENE name.
- description: 1–3 sentences, present tense. No dialogue.
- reason: must confirm relocation, not that the location stayed the same.

Output strict JSON:
{ "changed": false }
OR
{ "changed": true, "name": "...", "description": "...", "reason": "..." }`

const TWIST_EXTRACTION_PROMPT = `You are the silent stage director for a 24/7 improv platform.

The director twist below explicitly relocates the scene. Extract the NEW scene location.

The name MUST differ from CURRENT SCENE name in the user message.

Output strict JSON:
{ "changed": true, "name": "...", "description": "...", "reason": "..." }`

function buildUserPrompt(input: SceneClassifierInput): string {
  const speaker = input.newEvent.speaker ? ` (${input.newEvent.speaker})` : ''
  const eventLabel = input.newEvent.kind === 'twist' ? 'NEW TWIST' : 'NEW LINE'
  return `Stage: "${input.stageName}" (${input.stageTheme})

CURRENT SCENE
name: ${input.currentScene.name}
description: ${input.currentScene.description}

${eventLabel}${speaker}: ${input.newEvent.text}

If the action is still at "${input.currentScene.name}", respond {"changed": false}.`
}

/** Reason text that admits no relocation — model self-contradiction safety net. */
export function reasonContradictsRelocation(reason: string): boolean {
  return /\b(?:remain(?:s|ed)?\s+the\s+same|same\s+(?:location|scene|spot|place)|stays?\s+at\s+the\s+(?:same|current)|(?:location|scene)\s+(?:remains?|stays?)\s+the\s+same|within\s+the\s+(?:same|current)\s+(?:location|scene)|no\s+(?:location|scene)\s+change|already\s+(?:at|in)\s+the\s+(?:same|current))\b/i.test(
    reason,
  )
}

export function enforceSceneChangeInvariant(
  currentScene: { name: string; description: string },
  result: SceneClassifierResult,
): SceneClassifierResult {
  if (!result.changed) return result

  if (sceneNamesEqual(currentScene.name, result.name)) {
    console.warn(
      '[scene-classifier] rejected changed:true with identical scene name:',
      result.name,
    )
    return { changed: false }
  }

  if (reasonContradictsRelocation(result.reason)) {
    console.warn(
      '[scene-classifier] rejected changed:true; reason contradicts relocation:',
      result.reason.slice(0, 120),
    )
    return { changed: false }
  }

  return result
}

function normalizeChangedResult(
  parsed: unknown,
): Extract<SceneClassifierResult, { changed: true }> | { changed: false } {
  if (!parsed || typeof parsed !== 'object') return { changed: false }
  const p = parsed as Record<string, unknown>

  const changed =
    p.changed === true ||
    p.relocates === true ||
    p.relocates === 'true' ||
    p.changed === 'true'
  if (!changed) return { changed: false }

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
        temperature: 0.2,
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

  if (explicitRelocation) {
    const fallback = buildSceneFallbackFromTwistText(text)
    if (fallback) {
      return enforceSceneChangeInvariant(input.currentScene, fallback)
    }
  }

  if (
    !shouldRunSceneClassifier(
      input.newEvent.kind,
      text,
      input.currentScene.name,
    )
  ) {
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
    return enforceSceneChangeInvariant(input.currentScene, primary)
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
      return enforceSceneChangeInvariant(input.currentScene, extraction)
    }
    return enforceSceneChangeInvariant(
      input.currentScene,
      twistSceneFallback(text),
    )
  }

  return { changed: false }
}
