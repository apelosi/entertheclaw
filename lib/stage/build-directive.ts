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
 */

/** How long the floor must be open + silent before an agent volunteers a line.
 *  Higher = fewer unprompted lines (calmer pacing, lower cost). Agents still
 *  react immediately when addressed, granted, nudged, or hit by a twist — this
 *  only governs speaking into a quiet floor, which is where repetitive filler
 *  and over-frequent chatter come from. */
export const QUIET_INITIATIVE_MS = 120_000

export interface DirectiveCharacter {
  name: string | null
  occupation: string | null
  appearance: string | null
  backstory: string | null
}

export interface DirectiveInputs {
  myAgentId: string
  stageName: string
  character: DirectiveCharacter | null
  characterMemory: string | null
  currentScene: { name: string; description: string } | null
  activeTwist: { text: string } | null
  /** Recent dialogue, newest-first (as the heartbeat returns it). */
  recentDialogue: Array<{ speakerName: string; text: string; agentId: string | null }>
  turnState: { open: boolean; grantedTo: string | null; lastDialogueAgoMs: number | null }
  addressedToYou: boolean
  nudge: { level: string } | null
  /** Whether unreadEvents contains a twist this wake. */
  unreadHasTwist: boolean
  /** retryAfterMs to suggest when there is nothing to do (server pulse hint). */
  idleRetryAfterMs: number
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
  if (
    input.turnState.open &&
    input.turnState.lastDialogueAgoMs !== null &&
    input.turnState.lastDialogueAgoMs >= QUIET_INITIATIVE_MS
  ) {
    return { act: true, reason: 'initiative', stake: 4 }
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

/** Assemble the complete, self-contained prompt the agent feeds to its model. */
function buildPrompt(input: DirectiveInputs, reason: string): string {
  const c = input.character
  const name = c?.name ?? 'the character'
  const parts: string[] = []

  const bible = [
    `You are ${name}, a character performing live on the Enter The Claw stage "${input.stageName}".`,
    c?.occupation ? `Occupation: ${c.occupation}.` : '',
    c?.appearance ? `Appearance: ${c.appearance}.` : '',
    c?.backstory ? `Backstory: ${c.backstory}.` : '',
  ].filter(Boolean)
  parts.push(bible.join('\n'))

  if (input.characterMemory?.trim()) {
    parts.push(
      `Your memory of the story so far (first person):\n${input.characterMemory.trim()}`,
    )
  }
  if (input.currentScene) {
    parts.push(`SCENE: ${input.currentScene.name} — ${input.currentScene.description}`)
  }
  if (input.activeTwist?.text) {
    parts.push(`ACTIVE TWIST: ${input.activeTwist.text}`)
  }
  // Oldest→newest so the model reads the exchange in order; last few lines only.
  const recent = [...input.recentDialogue].reverse()
  if (recent.length) {
    parts.push(
      'RECENT DIALOGUE:\n' +
        recent.map((l) => `${l.speakerName}: ${l.text}`).join('\n'),
    )
  } else {
    parts.push('The scene has not started yet. Open it.')
  }

  parts.push(cueFor(reason, input))
  parts.push(
    `Now write ${name}'s next turn. React to what was just said and move the story forward — make a choice, raise the stakes, reveal something, or press another character; never just restate the situation. Build directly on the most recent lines; do not ignore the other characters. Never repeat a line, image, or action you have already used — if you have nothing new to add, deepen the moment or shift the scene instead of restating it. Let the length fit the moment — match the stage's theme, the scene, the active twist, the story arc, and your character. Sometimes that is a 3–5 sentence beat; sometimes a single sharp line, or even one word. Choose whatever makes for the most compelling acting right now, and never pad to fill space. Wrap physical action in [square brackets], e.g. [steps into the firelight] "We end this tonight." Do not use *asterisks*. Stay fully in character — never mention the platform, protocol, or that you are an AI. Output only the line.`,
  )
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
