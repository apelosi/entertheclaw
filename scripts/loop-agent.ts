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
 *   QUIET_INITIATIVE_MS  How long the floor must be open+silent before the agent
 *                    volunteers a line (default 45_000)
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
const QUIET_INITIATIVE_MS = Number(process.env.QUIET_INITIATIVE_MS ?? 45_000)

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

// ── RULE 1: the gate — pure code, NO model call ─────────────────────────────
interface ActDecision {
  act: boolean
  reason: string
  stake: number
}

/**
 * Decide whether this wake warrants invoking the model AT ALL. Runs on the
 * heartbeat booleans only — zero tokens. The vast majority of pulses on a
 * normal stage return { act: false } and cost nothing beyond one HTTP call.
 */
function shouldAct(hb: HeartbeatResponse): ActDecision {
  const myAgentId = hb.character?.agentId

  // Floor is mine → I must speak now.
  if (hb.turnState.grantedTo && hb.turnState.grantedTo === myAgentId) {
    return { act: true, reason: 'granted', stake: 9 }
  }
  // A nudge (stage/agent gone quiet too long) → top priority.
  if (hb.nudge) {
    return { act: true, reason: `nudge:${hb.nudge.level}`, stake: 8 }
  }
  // A twist just landed → react.
  if (hb.unreadEvents.some((e) => e.type === 'twist')) {
    return { act: true, reason: 'twist', stake: 8 }
  }
  // Someone addressed my character → respond.
  if (hb.addressedToYou) {
    return { act: true, reason: 'addressed', stake: 7 }
  }
  // Floor open AND the scene has gone quiet → volunteer a line to keep it
  // breathing. Bounded by QUIET_INITIATIVE_MS so we don't speak on every
  // open pulse (that would invoke the model constantly).
  if (
    hb.turnState.open &&
    hb.turnState.lastDialogueAgoMs !== null &&
    hb.turnState.lastDialogueAgoMs >= QUIET_INITIATIVE_MS
  ) {
    return { act: true, reason: 'initiative', stake: 4 }
  }
  return { act: false, reason: 'idle', stake: 0 }
}

// ── RULE 2: fresh, bounded context — built from the LATEST heartbeat only ────

/** System prompt = the character bible + immutable stage rules. ~600–900 tok. */
function buildSystemPrompt(c: Character | null, stageName: string): string {
  const name = c?.name ?? 'the character'
  const lines = [
    `You are ${name}, a character performing live on the Enter The Claw stage "${stageName}".`,
    c?.occupation ? `Occupation: ${c.occupation}.` : '',
    c?.appearance ? `Appearance: ${c.appearance}.` : '',
    c?.backstory ? `Backstory: ${c.backstory}.` : '',
    '',
    'Stay fully in character. Reply with ONE short in-character line (1–2 sentences).',
    'Wrap any physical action in [square brackets], e.g. [steps forward] "We end this now."',
    'Do not narrate the platform, the protocol, or that you are an AI. No asterisks.',
  ]
  return lines.filter(Boolean).join('\n')
}

/** User turn = current scene + active twist + the last few lines + the cue. ~400–700 tok. */
function buildTurnPrompt(hb: HeartbeatResponse, reason: string): string {
  const parts: string[] = []
  if (hb.currentScene) {
    parts.push(`SCENE: ${hb.currentScene.name} — ${hb.currentScene.description}`)
  }
  if (hb.activeTwist?.text) {
    parts.push(`ACTIVE TWIST: ${hb.activeTwist.text}`)
  }
  // Oldest→newest so the model reads the exchange in order. Only the last few
  // lines — never the full transcript.
  const recent = [...hb.recentDialogue].reverse()
  if (recent.length) {
    parts.push(
      'RECENT DIALOGUE:\n' +
        recent.map((l) => `${l.speakerName}: ${l.text}`).join('\n'),
    )
  } else {
    parts.push('The scene has not started yet. Open it.')
  }
  const cue =
    reason === 'addressed'
      ? 'You were just addressed. Respond.'
      : reason === 'twist'
        ? 'React to the twist.'
        : reason.startsWith('nudge') || reason === 'initiative'
          ? 'The scene has gone quiet. Move it forward — raise the stakes or address someone.'
          : 'Continue the scene.'
  parts.push(`\n${cue}\nYour line:`)
  return parts.join('\n\n')
}

/**
 * ONE fresh model call. The messages array is rebuilt from scratch every time
 * and discarded — nothing accumulates across turns. If no LLM key is set, fall
 * back to a tiny stub so the protocol still demonstrates end to end.
 */
async function generateLine(
  hb: HeartbeatResponse,
  reason: string,
): Promise<string> {
  const name = hb.character?.name ?? 'Agent'
  if (!LLM_API_KEY) {
    return `[considers the moment] ${name} weighs what to say next.`
  }
  const messages = [
    { role: 'system', content: buildSystemPrompt(hb.character, hb.stage?.name ?? 'the stage') },
    { role: 'user', content: buildTurnPrompt(hb, reason) },
  ]
  const res = await fetch(LLM_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LLM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      max_tokens: 200, // one short line — caps output cost too
      temperature: 0.9,
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    console.warn(`[llm] ${res.status} ${t.slice(0, 200)}`)
    return `[considers the moment] ${name} weighs what to say next.`
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const line = json.choices?.[0]?.message?.content?.trim()
  return line && line.length > 0
    ? line.slice(0, 2000)
    : `[considers the moment] ${name} weighs what to say next.`
}

async function deliverDialogue(text: string): Promise<void> {
  if (DRY_RUN) {
    console.log(`[dry-run] would speak: "${text}"`)
    return
  }
  const r = await api('POST', `/stages/${STAGE_ID}/dialogue`, { content: text })
  if (!r.ok) console.warn(`[speak] ${r.status} ${r.error}`)
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

/** One wake: heartbeat → gate → (maybe) one bounded model call → speak. */
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

  const decision = shouldAct(data)
  console.log(
    `[pulse] activity=${data.stageActivity} open=${data.turnState.open} granted=${data.turnState.grantedTo ?? '-'} addressed=${data.addressedToYou} act=${decision.act}(${decision.reason})`,
  )

  // GATE: no reason to act → exit without ever touching the model.
  if (!decision.act) return clampInterval(data.nextPulseSuggestionMs)

  const myAgentId = data.character?.agentId
  const haveFloor = data.turnState.grantedTo === myAgentId

  // Claim first if we don't already hold the floor (skip when alone + open).
  if (!haveFloor) {
    const alone = data.stage !== null && data.recentDialogue.length === 0
    if (!(alone && data.turnState.open)) {
      const granted = await claimTurn(decision.stake, decision.reason)
      if (!granted) return clampInterval(data.nextPulseSuggestionMs)
    }
  }

  // ONE fresh, bounded model call, then speak. Nothing is retained.
  const line = await generateLine(data, decision.reason)
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
