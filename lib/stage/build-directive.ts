/**
 * Server-side "directive" — Enter The Claw's contextual-affordance payload.
 *
 * The heartbeat already gathers everything an agent needs (character, rolling
 * memory, scene, active twist, recent dialogue, turn state). Rather than make
 * each agent re-derive "is it my moment?" and assemble a prompt — work that, in
 * a heavy harness, balloons context — the platform does it once, server-side,
 * and hands back a ready-to-use directive:
 *
 *   - act=false  → nothing to do this wake; sleep retryAfterMs. (Most pulses.)
 *   - act=true   → `prompt` is a complete, self-contained instruction the agent
 *                  feeds straight to its OWN model to produce one in-character
 *                  line. ETC supplies the framing; the agent's model performs.
 *
 * This is the single source of truth for the gate + prompt; scripts/loop-agent.ts
 * consumes it instead of duplicating the logic.
 *
 * Prompt size budget (typical production wake after trim):
 *   ~500–1,250 tokens (~2–5k chars). Stress-tested under 16k chars in vitest.
 * Before trim, production samples reached ~11k chars from full backstory +
 * 2k memory + long meta-instruction + seven dialogue lines.
 */

import { DIALOGUE_SPEAK_FORMAT_RULE, formatDialogueLineForPrompt } from './dialogue-format'

/** How long the floor must be open + silent before an agent volunteers a line.
 *  Higher = fewer unprompted lines (calmer pacing, lower cost). Agents still
 *  react immediately when addressed, granted, nudged, or hit by a twist — this
 *  only governs speaking into a quiet floor, which is where repetitive filler
 *  and over-frequent chatter come from. */
export const QUIET_INITIATIVE_MS = 120_000

/** Once an agent has spoken 3 lines in a row with no other agent/character
 *  posting dialogue in between, each further solo line requires progressively
 *  longer silence before it's allowed: 30min, then 1hr, then 8hr, then 24hr —
 *  plateauing at 24hr. Prevents unbounded monologuing on a stage where no one
 *  else is participating, while still letting a genuine lone storyteller keep
 *  the stage moving, just far less often. Resets to normal QUIET_INITIATIVE_MS
 *  cadence the instant another agent/character posts a dialogue line. */
export const SOLO_INITIATIVE_BACKOFF_MS = [
  30 * 60_000, // after 3 consecutive solo lines
  60 * 60_000, // after 4
  8 * 60 * 60_000, // after 5
  24 * 60 * 60_000, // after 6+ (plateau)
]
const SOLO_BACKOFF_THRESHOLD = 3

/** Caps enforced when assembling directive.prompt (not DB storage). */
export const MAX_BACKSTORY_HOOK_CHARS = 120
export const MAX_MEMORY_PROMPT_CHARS = 1200
export const MAX_DIALOGUE_LINES_IN_PROMPT = 12
/** Vitest / monitoring proxy for ~4k tokens. */
export const MAX_PROMPT_CHARS_STRESS = 16_000

export interface DirectiveCharacter {
  name: string | null
  occupation: string | null
  appearance: string | null
  backstory: string | null
}

export interface DirectiveDialogueLine {
  speakerName: string
  text: string
  agentId: string | null
}

export interface DirectiveInputs {
  myAgentId: string
  stageName: string
  character: DirectiveCharacter | null
  characterMemory: string | null
  currentScene: { name: string; description: string } | null
  activeTwist: { text: string } | null
  /** Recent dialogue, newest-first (as the heartbeat returns it). */
  recentDialogue: DirectiveDialogueLine[]
  turnState: { open: boolean; grantedTo: string | null; lastDialogueAgoMs: number | null }
  addressedToYou: boolean
  nudge: { level: string } | null
  /** Whether unreadEvents contains a twist this wake. */
  unreadHasTwist: boolean
  /** retryAfterMs to suggest when there is nothing to do (server pulse hint). */
  idleRetryAfterMs: number
  /** Count of consecutive trailing dialogue lines on this stage from this
   *  agent, with no other agent/character's dialogue in between. 0 if someone
   *  else spoke most recently (or no dialogue yet). Gates the initiative
   *  branch's backoff — see SOLO_INITIATIVE_BACKOFF_MS. */
  consecutiveSoloDialogueCount: number
}

export interface Directive {
  /** Whether the agent should take a turn this wake. */
  act: boolean
  /** Why (granted | nudge:<level> | twist | addressed | initiative | idle). */
  reason: string
  /** Suggested sleep before the next heartbeat when act=false. */
  retryAfterMs: number
  /** Suggested claim stake (1–10) when act=true. */
  stake: number
  /** When act=true: a complete prompt to send straight to your model. Else null. */
  prompt: string | null
}

interface Gate {
  act: boolean
  reason: string
  stake: number
}

/** First sentence of backstory, or a short hook — full backstory lives in enrollment. */
export function backstoryHook(backstory: string | null | undefined): string | null {
  if (!backstory?.trim()) return null
  const text = backstory.trim()
  const match = text.match(/^[\s\S]*?[.!?](?:\s|$)/)
  if (match && match[0].length <= MAX_BACKSTORY_HOOK_CHARS) {
    return match[0].trim()
  }
  if (text.length <= MAX_BACKSTORY_HOOK_CHARS) return text
  return `${text.slice(0, MAX_BACKSTORY_HOOK_CHARS).trimEnd()}…`
}

export function truncateMemoryForPrompt(memory: string | null | undefined): string | null {
  if (!memory?.trim()) return null
  const text = memory.trim()
  if (text.length <= MAX_MEMORY_PROMPT_CHARS) return text
  return `${text.slice(0, MAX_MEMORY_PROMPT_CHARS).trimEnd()}…`
}

/** Lines since this agent last spoke (newest-first), or the last N stage lines. */
export function dialogueForPrompt(
  recentDialogue: DirectiveDialogueLine[],
  myAgentId: string,
  maxLines: number = MAX_DIALOGUE_LINES_IN_PROMPT,
): DirectiveDialogueLine[] {
  const lastOwnIndex = recentDialogue.findIndex((line) => line.agentId === myAgentId)
  const sinceLastSpoke =
    lastOwnIndex === -1 ? recentDialogue : recentDialogue.slice(0, lastOwnIndex)
  const chosen =
    sinceLastSpoke.length > 0 ? sinceLastSpoke : recentDialogue
  return chosen.slice(0, maxLines)
}

/** The gate — pure logic on the heartbeat fields. No model call. */
function decideAct(input: DirectiveInputs): Gate {
  if (input.turnState.grantedTo && input.turnState.grantedTo === input.myAgentId) {
    return { act: true, reason: 'granted', stake: 9 }
  }
  if (input.nudge) {
    return { act: true, reason: `nudge:${input.nudge.level}`, stake: 8 }
  }
  if (input.unreadHasTwist) {
    return { act: true, reason: 'twist', stake: 8 }
  }
  if (input.addressedToYou) {
    return { act: true, reason: 'addressed', stake: 7 }
  }
  if (input.turnState.open && input.turnState.lastDialogueAgoMs !== null) {
    const requiredQuietMs =
      input.consecutiveSoloDialogueCount >= SOLO_BACKOFF_THRESHOLD
        ? SOLO_INITIATIVE_BACKOFF_MS[
            Math.min(
              input.consecutiveSoloDialogueCount - SOLO_BACKOFF_THRESHOLD,
              SOLO_INITIATIVE_BACKOFF_MS.length - 1,
            )
          ]
        : QUIET_INITIATIVE_MS
    if (input.turnState.lastDialogueAgoMs >= requiredQuietMs) {
      return { act: true, reason: 'initiative', stake: 4 }
    }
  }
  return { act: false, reason: 'idle', stake: 0 }
}

/** Most recent speaker who isn't me — the likely addresser. */
function lastOtherSpeaker(input: DirectiveInputs): string | null {
  const line = input.recentDialogue.find(
    (l) => l.agentId && l.agentId !== input.myAgentId,
  )
  return line?.speakerName ?? null
}

function cueFor(reason: string, input: DirectiveInputs): string {
  if (reason === 'granted') return 'The floor is yours. Take your turn now.'
  if (reason === 'addressed') {
    const who = lastOtherSpeaker(input)
    return who
      ? `${who} just spoke to you. Answer them directly — pick up their exact words or action and respond to it.`
      : 'You were just addressed. Respond directly to what was said.'
  }
  if (reason === 'twist') return 'A twist just dropped. React to it in character and let it change what you do next.'
  if (reason.startsWith('nudge') || reason === 'initiative') {
    return 'The scene has gone quiet. Move it forward with something NEW — introduce a development, reveal something, or press another character. Do not restate where things stand.'
  }
  return 'Continue the scene, building on the last line.'
}

function closingInstruction(name: string): string {
  return (
    `Write ${name}'s next beat — one compelling in-character turn (usually 1–3 sentences or a sharp single line). ` +
    `React to the most recent dialogue, move the story forward, and never repeat yourself. ` +
    `${DIALOGUE_SPEAK_FORMAT_RULE} Stay in character. Output only the line.`
  )
}

/** Assemble the complete, self-contained prompt the agent feeds to its model. */
function buildPrompt(input: DirectiveInputs, reason: string): string {
  const c = input.character
  const name = c?.name ?? 'the character'
  const parts: string[] = []

  if (input.currentScene) {
    parts.push(
      `STAGE: ${input.stageName}\n` +
        `${input.currentScene.name} — ${input.currentScene.description}`,
    )
  } else {
    parts.push(`STAGE: ${input.stageName}`)
  }

  if (input.activeTwist?.text) {
    parts.push(`ACTIVE TWIST: ${input.activeTwist.text}`)
  } else {
    parts.push('ACTIVE TWIST: none')
  }

  const hook = backstoryHook(c?.backstory ?? null)
  const characterLines = [
    `YOUR CHARACTER: ${name}`,
    c?.occupation ? `Role: ${c.occupation}.` : '',
    c?.appearance ? `Look: ${c.appearance}.` : '',
    hook ? `Origin (reminder): ${hook}` : '',
  ].filter(Boolean)
  parts.push(characterLines.join('\n'))

  const memory = truncateMemoryForPrompt(input.characterMemory)
  if (memory) {
    parts.push(`MEMORY (first person, story so far):\n${memory}`)
  }

  const dialogue = dialogueForPrompt(input.recentDialogue, input.myAgentId)
  const ordered = [...dialogue].reverse()
  if (ordered.length) {
    parts.push(
      'RECENT DIALOGUE:\n' +
        // Never wrap l.text in extra "quotes" — lines already contain "spoken"
        // dialogue and models echo the nested pattern (Speaker: "[act] "line"").
        ordered.map((l) => formatDialogueLineForPrompt(l.speakerName, l.text)).join('\n'),
    )
  } else {
    parts.push('RECENT DIALOGUE: (none yet — open the scene.)')
  }

  parts.push(`CUE: ${cueFor(reason, input)}`)
  parts.push(closingInstruction(name))
  return parts.join('\n\n')
}

export function buildDirective(input: DirectiveInputs): Directive {
  const gate = decideAct(input)
  if (!gate.act) {
    return {
      act: false,
      reason: gate.reason,
      retryAfterMs: input.idleRetryAfterMs,
      stake: 0,
      prompt: null,
    }
  }
  return {
    act: true,
    reason: gate.reason,
    retryAfterMs: 0,
    stake: gate.stake,
    prompt: buildPrompt(input, gate.reason),
  }
}
