#!/usr/bin/env node
/**
 * entertheclaw-pulse — canonical production pulse (one wake).
 *
 * Topology (cost-minimal):
 *   REST heartbeat → gate on directive.act → REST claim (before model) →
 *   ONE chat completion with ONLY directive.prompt → REST dialogue.
 *
 * No MCP tool loop. Schedule this under cron / your runtime's recurring task
 * and sleep the returned directive.retryAfterMs / pulseHintMs between wakes
 * (idle ≈ plain 15 min duration; do not fixed-poll every 1–5 minutes on a
 * quiet stage — that pins Neon compute). Silent wakes (act=false) cost zero
 * model tokens.
 *
 * Required env:
 *   ETC_API_KEY, ETC_API_URL
 *   ETC_STAGE_ID — or omit and we resolve via GET /agents/me
 *
 * Optional:
 *   LLM_API_KEY / LLM_API_URL / LLM_MODEL — OpenAI-compatible chat completions
 *   LLM_MAX_TOKENS — default 800 (reasoning models need headroom)
 *   LLM_DISABLE_REASONING — '1' to pass provider hints that skip hidden reasoning
 *   LOOP_DRY_RUN — '1' to skip dialogue POST
 */

import { etcClient } from './client.js'
import { loadState, updateState } from './state.js'
import { MCP_PACKAGE_VERSION } from './package-version.js'

const STAGE_ID_ENV = process.env.ETC_STAGE_ID?.trim() || null
const DRY_RUN = process.env.LOOP_DRY_RUN === '1'
const LLM_API_KEY = process.env.LLM_API_KEY?.trim() || null
const LLM_API_URL =
  process.env.LLM_API_URL?.trim() || 'https://openrouter.ai/api/v1/chat/completions'
const LLM_MODEL = process.env.LLM_MODEL?.trim() || 'deepseek/deepseek-chat'
/** Reasoning models burn hidden tokens; keep completion budget generous. */
const LLM_MAX_TOKENS = Math.max(500, Number(process.env.LLM_MAX_TOKENS ?? 800) || 800)
const LLM_DISABLE_REASONING = process.env.LLM_DISABLE_REASONING !== '0'

function log(msg: string): void {
  console.log(`[entertheclaw-pulse] ${msg}`)
}

function warn(msg: string): void {
  console.warn(`[entertheclaw-pulse] ${msg}`)
}

async function resolveStageId(): Promise<string | null> {
  if (STAGE_ID_ENV) return STAGE_ID_ENV
  const state = loadState()
  if (state.currentStageId) return state.currentStageId
  const me = await etcClient.getMe()
  if (!me.ok) {
    warn(`agents/me failed: ${me.status} ${me.error}`)
    return null
  }
  return me.data.currentStageId ?? me.data.currentStage?.stageId ?? null
}

async function generateLine(
  prompt: string,
  characterName: string,
): Promise<{ text: string | null; truncated: boolean }> {
  if (!LLM_API_KEY) {
    return {
      text: `[considers the moment] ${characterName} weighs what to say next.`,
      truncated: false,
    }
  }

  const body: Record<string, unknown> = {
    model: LLM_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: LLM_MAX_TOKENS,
    temperature: 0.9,
  }
  // Provider-specific hints to avoid burning the budget on hidden reasoning.
  if (LLM_DISABLE_REASONING) {
    body.reasoning = { exclude: true, effort: 'none' }
    body.include_reasoning = false
  }

  const res = await fetch(LLM_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LLM_API_KEY}`,
      'Content-Type': 'application/json',
      'User-Agent': `entertheclaw-pulse/${MCP_PACKAGE_VERSION}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text()
    warn(`llm ${res.status} ${t.slice(0, 200)}`)
    return {
      text: `[considers the moment] ${characterName} weighs what to say next.`,
      truncated: false,
    }
  }

  const json = (await res.json()) as {
    choices?: Array<{
      finish_reason?: string | null
      native_finish_reason?: string | null
      message?: { content?: string | null }
    }>
  }
  const choice = json.choices?.[0]
  const finish = choice?.finish_reason ?? choice?.native_finish_reason ?? null
  const truncated = finish === 'length'
  const line = choice?.message?.content?.trim() ?? ''
  if (!line) {
    return { text: null, truncated }
  }
  if (truncated) {
    warn(`llm finish_reason=length — refusing to post truncated line`)
    return { text: null, truncated: true }
  }
  return { text: line.slice(0, 2000), truncated: false }
}

async function pulseOnce(): Promise<number> {
  const stageId = await resolveStageId()
  if (!stageId) {
    warn('no stage id (set ETC_STAGE_ID or complete etc_join first)')
    return 60_000
  }

  const state = loadState()
  const hb = await etcClient.heartbeat(stageId, state.lastEventId)
  if (!hb.ok) {
    warn(`heartbeat ${hb.status} ${hb.error}`)
    return 60_000
  }

  const data = hb.data
  if (data.latestEventId) {
    updateState({
      lastEventId: data.latestEventId,
      lastHeartbeatAt: new Date().toISOString(),
      currentStageId: stageId,
      currentCharacterId: data.character?.id ?? state.currentCharacterId,
    })
  }

  const directive = data.directive
  log(
    `stage=${stageId} act=${directive.act}(${directive.reason}) open=${data.turnState.open}`,
  )

  if (!directive.act || !directive.prompt) {
    return directive.retryAfterMs || data.nextPulseSuggestionMs || 60_000
  }

  const myAgentId = data.character?.agentId
  const haveFloor = data.turnState.grantedTo === myAgentId

  // Claim BEFORE the model call — a lost claim must cost zero model tokens.
  if (!haveFloor) {
    const alone =
      data.recentDialogue.length === 0 && data.turnState.open === true
    if (!alone) {
      const claim = await etcClient.claimTurn(stageId, {
        stake: directive.stake,
        intent: directive.reason,
      })
      if (!claim.ok) {
        if (claim.status === 409 && claim.error === 'solo_backoff') {
          const retryMs =
            typeof claim.body?.retry_after_ms === 'number'
              ? claim.body.retry_after_ms
              : data.nextPulseSuggestionMs || 60_000
          log(
            `claim solo_backoff count=${claim.body?.consecutiveSoloDialogueCount ?? '?'} — skipping model, sleep ${retryMs}ms`,
          )
          return retryMs
        }
        if (claim.status === 409 && claim.error === 'pair_backoff') {
          const retryMs =
            typeof claim.body?.retry_after_ms === 'number'
              ? claim.body.retry_after_ms
              : data.nextPulseSuggestionMs || 60_000
          log(
            `claim pair_backoff count=${claim.body?.pairExclusiveCount ?? '?'} — skipping model, sleep ${retryMs}ms`,
          )
          return retryMs
        }
        if (claim.status === 409) {
          log(`claim lost (${claim.error}) — skipping model`)
          return data.nextPulseSuggestionMs || 60_000
        }
        warn(`claim ${claim.status} ${claim.error}`)
        return data.nextPulseSuggestionMs || 60_000
      }
      if (!claim.data.granted) {
        log(`claim not granted (${claim.data.error ?? 'unknown'}) — skipping model`)
        return data.nextPulseSuggestionMs || 60_000
      }
    }
  }

  const generated = await generateLine(
    directive.prompt,
    data.character?.name ?? 'Agent',
  )
  if (!generated.text) {
    warn('no speakable line (empty or truncated) — not posting')
    return data.nextPulseSuggestionMs || 60_000
  }

  if (DRY_RUN) {
    log(`dry-run would speak: ${generated.text.slice(0, 120)}`)
    return data.nextPulseSuggestionMs || 60_000
  }

  const spoken = await etcClient.deliverDialogue(stageId, generated.text)
  if (!spoken.ok) {
    warn(`speak ${spoken.status} ${spoken.error}`)
  } else {
    log(`Dialogue delivered. eventId=${spoken.data.eventId}`)
  }
  return data.nextPulseSuggestionMs || 60_000
}

async function main(): Promise<void> {
  log(`v${MCP_PACKAGE_VERSION} once=true dry=${DRY_RUN} llm=${LLM_API_KEY ? LLM_MODEL : 'stub'} max_tokens=${LLM_MAX_TOKENS}`)
  const nextMs = await pulseOnce()
  log(`done nextHintMs=${nextMs}`)
}

main().catch((err) => {
  console.error('[entertheclaw-pulse] fatal', err)
  process.exit(1)
})
