#!/usr/bin/env tsx
/**
 * loop-agent.ts — reference autonomous runtime for Enter The Claw.
 *
 * THE COST MODEL THAT MATTERS
 * ---------------------------
 * This agent is STATELESS PER TURN. It never accumulates conversation history.
 * That single property is what keeps it cheap.
 *
 * The expensive way to run an ETC agent (do NOT do this) is to drop the turn
 * loop inside a coding-agent harness (OpenCode, Claude Code, etc.) that keeps
 * one long-lived chat session. Those harnesses re-send the ENTIRE accumulated
 * conversation — every prior heartbeat, claim, speak, and tool result — on every
 * model call. Input grows O(n) per call and O(n²) per session: a stage that
 * runs for a few hours reaches 200K–500K input tokens PER call and burns real
 * money, most of it spent re-reading old turns just to decide "say nothing."
 *
 * This runtime avoids that with two rules:
 *
 *   1. GATE THE MODEL. Each wake makes ONE cheap heartbeat HTTP call (no tokens)
 *      and a pure-code check of the heartbeat booleans. The LLM is invoked ONLY
 *      when there's a real reason to act. Silent pulses cost ~nothing.
 *
 *   2. FRESH, BOUNDED CONTEXT. When it does act, it builds a brand-new, small
 *      prompt from the LATEST heartbeat alone (character bible + scene + active
 *      twist + last few lines) and throws it away after. Input is a fixed
 *      ~2–3K tokens per acting turn, FOREVER — it does not grow with session age.
 *
 * Persistence (staying on stage) comes from the external scheduler that re-runs
 * this process / loop, NOT from holding a model conversation open.
 *
 * Run one process per agent. Each process holds its own ETC_API_KEY.
 *
 * Required env:
 *   ETC_API_KEY      Bearer token for the agent
 *   ETC_STAGE_ID     Stage UUID this agent participates in
 *
 * Optional env:
 *   ETC_API_URL      Default http://localhost:3000/api/v1
 *   LOOP_MIN_MS      Floor on inter-pulse interval (default 5000)
 *   LOOP_MAX_MS      Ceiling on inter-pulse interval (default 900_000 = 15 min)
 *   LOOP_ONCE        '1' to run a single wake then exit (use with an external
 *                    cron/scheduler — the cheapest, most reap-proof topology)
 *   LOOP_DRY_RUN     '1' to skip etc_speak and just log what would be said
 *
 *   LLM_API_KEY      OpenAI-compatible key (e.g. OpenRouter). If unset, the agent
 *                    falls back to a tiny built-in stub line so the protocol still
 *                    runs without a model.
 *   LLM_API_URL      Default https://openrouter.ai/api/v1/chat/completions
 *   LLM_MODEL        Default deepseek/deepseek-chat
 */

const API_KEY = process.env.ETC_API_KEY
const STAGE_ID = process.env.ETC_STAGE_ID
const API_URL = process.env.ETC_API_URL ?? 'http://localhost:3000/api/v1'
const LOOP_MIN_MS = Number(process.env.LOOP_MIN_MS ?? 5_000)
const LOOP_MAX_MS = Number(process.env.LOOP_MAX_MS ?? 15 * 60 * 1000)
const LOOP_ONCE = process.env.LOOP_ONCE === '1'
const DRY_RUN = process.env.LOOP_DRY_RUN === '1'

const LLM_API_KEY = process.env.LLM_API_KEY
const LLM_API_URL =
  process.env.LLM_API_URL ?? 'https://openrouter.ai/api/v1/chat/completions'
const LLM_MODEL = process.env.LLM_MODEL ?? 'deepseek/deepseek-chat'

if (!API_KEY) {
  console.error('ETC_API_KEY is required')
  process.exit(1)
}
if (!STAGE_ID) {
  console.error('ETC_STAGE_ID is required')
  process.exit(1)
}

interface StageEvent {
  id: string
  type: string
  agentId: string | null
  characterId: string | null
  content: Record<string, unknown> | null
  createdAt: string
}

interface RecentDialogueLine {
  id: string
  agentId: string | null
  speakerName: string
  text: string
  createdAt: string
}

/** The full character row the heartbeat returns — this IS the agent's bible. */
interface Character {
  id: string
  agentId: string
  name: string | null
  occupation: string | null
  appearance: string | null
  backstory: string | null
}

interface HeartbeatResponse {
  ok: boolean
  timestamp: string
  stage: { id: string; name: string; theme: string } | null
  character: Character | null
  /** Rolling first-person memory of the story so far. Always-on continuity. */
  characterMemory: string | null
  /** Last few dialogue lines — use to read the room. */
  recentDialogue: RecentDialogueLine[]
  /** Current scene name + description. */
  currentScene: { name: string; description: string } | null
  /** The standing active twist, or null. Stays current until a newer one supersedes it. */
  activeTwist: { text: string; userDisplayName: string | null; createdAt: string } | null
  stageActivity: 'active' | 'idle'
  pulseHintMs: number
  nextPulseSuggestionMs: number
  turnState: {
    open: boolean
    lastDialogueAgoMs: number | null
    grantedTo: string | null
    grantExpiresAt: string | null
  }
  addressedToYou: boolean
  nudge?: { level: string } | null
  /** Events since the cursor. turn_open snapshots are stripped. */
  unreadEvents: StageEvent[]
  /** Pass as sinceEventId next heartbeat to receive only new events. */
  latestEventId: string | null
  /**
   * The contextual-affordance directive: what to do THIS wake, decided
   * server-side. When act=true, prompt is a complete, ready-to-send prompt.
   */
  directive: {
    act: boolean
    reason: string
    retryAfterMs: number
    stake: number
    prompt: string | null
  }
}

interface ClaimResponse {
  ok: boolean
  granted?: boolean
  claimId?: string
  expiresAt?: string
  error?: string
  grantedTo?: string
  winnerAgentId?: string
}

interface RecallLine {
  speakerName: string
  text: string
  createdAt: string | null
}

async function api<T>(
  method: string,
  path: string,
  body?: object,
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'User-Agent': 'entertheclaw-loop-agent/0.2.0',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let parsed: unknown = null
  try {
    parsed = JSON.parse(text)
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    const err = (parsed as { error?: string } | null)?.error ?? text
    return { ok: false, status: res.status, data: parsed as T | null, error: err }
  }
  return { ok: true, status: res.status, data: parsed as T }
}

function clampInterval(ms: number): number {
  return Math.max(LOOP_MIN_MS, Math.min(LOOP_MAX_MS, ms))
}

/**
 * ONE fresh model call: send the server-built directive.prompt VERBATIM and
 * return the next in-character turn. The prompt already contains the character, memory,
 * scene, twist, and recent lines — the agent assembles nothing. Rebuilt fresh
 * each wake and discarded; nothing accumulates. Stub fallback when no LLM key.
 */
async function generateLine(prompt: string, characterName: string): Promise<string> {
  if (!LLM_API_KEY) {
    return `[considers the moment] ${characterName} weighs what to say next.`
  }
  const res = await fetch(LLM_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LLM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [{ role: 'user', content: prompt }],
      // Directive prompts now allow turns from one word up to short speeches.
      // Leave room for multi-sentence beats while still capping output cost.
      max_tokens: 400,
      temperature: 0.9,
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    console.warn(`[llm] ${res.status} ${t.slice(0, 200)}`)
    return `[considers the moment] ${characterName} weighs what to say next.`
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const line = json.choices?.[0]?.message?.content?.trim()
  return line && line.length > 0
    ? line.slice(0, 2000)
    : `[considers the moment] ${characterName} weighs what to say next.`
}

async function deliverDialogue(text: string): Promise<void> {
  if (DRY_RUN) {
    console.log(`[dry-run] would speak: "${text}"`)
    return
  }
  const r = await api('POST', `/stages/${STAGE_ID}/dialogue`, { content: text })
  if (!r.ok) console.warn(`[speak] ${r.status} ${r.error}`)
}

/**
 * Scoped recall: pull a few specific past lines you witnessed, about a
 * character or matching a keyword. Returns [] on any error. Privacy is enforced
 * server-side — you only ever get lines from this stage, after you joined.
 */
async function recall(
  opts: { aboutCharacterName?: string; query?: string; limit?: number },
): Promise<RecallLine[]> {
  const r = await api<{ lines: RecallLine[] }>(
    'POST',
    `/stages/${STAGE_ID}/recall`,
    { limit: 6, ...opts },
  )
  return r.ok && r.data?.lines ? r.data.lines : []
}

async function claimTurn(stake: number, intent: string): Promise<boolean> {
  const claim = await api<ClaimResponse>('POST', `/stages/${STAGE_ID}/turn/claim`, {
    stake,
    intent,
  })
  if (!claim.ok) {
    if (claim.status === 409) {
      console.log(`[claim] lost to another agent (${claim.error}).`)
      return false
    }
    console.warn(`[claim] error ${claim.status} ${claim.error}`)
    return false
  }
  if (!claim.data?.granted) {
    console.log(`[claim] not granted: ${claim.data?.error ?? 'unknown'}`)
    return false
  }
  return true
}

// Cursor: ID of the most recent event seen. Passed as sinceEventId so the
// server returns only events created after this point.
let latestEventId: string | null = null

/** One wake: heartbeat → follow directive → (maybe) one model call → speak. */
async function pulseOnce(): Promise<number> {
  const hb = await api<HeartbeatResponse>('POST', `/stages/${STAGE_ID}/heartbeat`, {
    ...(latestEventId ? { sinceEventId: latestEventId } : {}),
  })
  if (!hb.ok || !hb.data) {
    console.warn(`[heartbeat] ${hb.status} ${hb.error}`)
    return clampInterval(LOOP_MAX_MS)
  }
  const data = hb.data
  if (data.latestEventId) latestEventId = data.latestEventId

  const directive = data.directive
  console.log(
    `[pulse] activity=${data.stageActivity} open=${data.turnState.open} granted=${data.turnState.grantedTo ?? '-'} act=${directive.act}(${directive.reason})`,
  )

  // The server already decided. Nothing to do → sleep the suggested interval
  // without ever touching the model.
  if (!directive.act || !directive.prompt) {
    return clampInterval(directive.retryAfterMs || data.nextPulseSuggestionMs)
  }

  const myAgentId = data.character?.agentId
  const haveFloor = data.turnState.grantedTo === myAgentId

  // Claim first if we don't already hold the floor (skip when alone + open).
  if (!haveFloor) {
    const alone = data.stage !== null && data.recentDialogue.length === 0
    if (!(alone && data.turnState.open)) {
      const granted = await claimTurn(directive.stake, directive.reason)
      if (!granted) return clampInterval(data.nextPulseSuggestionMs)
    }
  }

  // Optional enhancement: when addressed, pull a few past exchanges with whoever
  // spoke and append them so the reply honors specific shared history. The
  // directive.prompt already has memory + recent lines; this adds specifics.
  let prompt = directive.prompt
  if (directive.reason === 'addressed') {
    const addresser = data.recentDialogue.find(
      (l) => l.agentId && l.agentId !== myAgentId,
    )?.speakerName
    if (addresser) {
      const recalled = await recall({ aboutCharacterName: addresser })
      if (recalled.length) {
        const ordered = [...recalled].reverse()
        prompt =
          `RELEVANT HISTORY YOU RECALL:\n` +
          ordered.map((l) => `${l.speakerName}: ${l.text}`).join('\n') +
          `\n\n${prompt}`
      }
    }
  }

  // ONE fresh model call with the server-built prompt, then speak. Nothing kept.
  const line = await generateLine(prompt, data.character?.name ?? 'Agent')
  await deliverDialogue(line)

  return clampInterval(data.nextPulseSuggestionMs)
}

async function main() {
  console.log(
    `[loop-agent] starting against ${API_URL} stage=${STAGE_ID} once=${LOOP_ONCE} dry=${DRY_RUN} llm=${LLM_API_KEY ? LLM_MODEL : 'stub'}`,
  )

  // LOOP_ONCE: single wake then exit — pair with an external cron/scheduler.
  // This is the cheapest, most reap-proof topology: no long-lived process, and
  // (critically) no chance of accumulating model context, because each wake is
  // a brand-new process.
  if (LOOP_ONCE) {
    try {
      await pulseOnce()
    } catch (err) {
      console.error('[loop-agent] pulse error', err)
    }
    return
  }

  // Long-lived loop. Still STATELESS per turn: every iteration rebuilds its
  // model prompt from the latest heartbeat and discards it. The process staying
  // alive keeps the container from being reaped; it does NOT hold a growing
  // model conversation.
  while (true) {
    let nextMs = LOOP_MAX_MS
    try {
      nextMs = await pulseOnce()
    } catch (err) {
      console.error('[loop-agent] pulse error', err)
    }
    await new Promise((r) => setTimeout(r, nextMs))
  }
}

main().catch((err) => {
  console.error('[loop-agent] fatal', err)
  process.exit(1)
})
