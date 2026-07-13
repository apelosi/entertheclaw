import { describe, expect, it } from 'vitest'
import {
  analyzeDialogueRepair,
  closeBracketBeforeQuotes,
  emoteContainsDialogue,
  ensureClosingQuote,
  isDialogueOpenerInBrackets,
  isEmbeddedCitationInBrackets,
  isEmphasisBracket,
  normalizeDialogueQuotes,
  normalizeStageDirectionMarkers,
  repairDialogueFormatting,
  segmentRenderedLength,
  splitDialogueSegments,
  stripAgentToolLeakage,
  formatDialogueLineForPrompt,
  DIALOGUE_SPEAK_FORMAT_RULE,
  unwrapEmphasisBracketsInQuotes,
  unwrapOuterDialogueQuotes,
  wrapUnbracketedDirectionBeforeQuotes,
} from '../dialogue-format'

describe('normalizeStageDirectionMarkers', () => {
  it('converts asterisk actions to brackets outside quotes', () => {
    expect(normalizeStageDirectionMarkers('[glances *away*] "Hello."')).toBe(
      '[glances [away]] "Hello."',
    )
  })

  it('strips asterisk emphasis inside quotes without adding brackets', () => {
    expect(normalizeStageDirectionMarkers('"The bridle is not broken—it is *listening*."')).toBe(
      '"The bridle is not broken—it is listening."',
    )
  })
})

describe('isEmphasisBracket', () => {
  it('matches single-word emphasis tokens', () => {
    expect(isEmphasisBracket('listening')).toBe(true)
    expect(isEmphasisBracket('wants')).toBe(true)
    expect(isEmphasisBracket('stillborn')).toBe(true)
  })

  it('rejects multi-word stage direction', () => {
    expect(isEmphasisBracket('glances at the door')).toBe(false)
    expect(isEmphasisBracket('Her voice drops')).toBe(false)
  })
})

describe('repairDialogueFormatting — production regressions', () => {
  it('wraps unbracketed stage direction before spoken quotes (Class C)', () => {
    const raw =
      "Kaelen's cybernetic eye flickers, scanning the static-fractured symbol still fading in the air. \"A bloodline key means the sender wasn't just any intelligence-they were family."
    const fixed = repairDialogueFormatting(raw)
    expect(fixed).toBe(
      "[Kaelen's cybernetic eye flickers, scanning the static-fractured symbol still fading in the air.] \"A bloodline key means the sender wasn't just any intelligence-they were family.\"",
    )
    const segments = splitDialogueSegments(fixed)
    expect(segments.map((s) => s.kind)).toEqual(['direction', 'spoken'])
  })

  it('unwraps outer quotes and trims trailing quote garbage', () => {
    const raw =
      '"[Seraphis\'s hand drifts to the kyber at his chest, the pulse of the crystal now a whisper against his palm.] "The frequency in that tuning fork-I\'ve felt it before. In the ruins of Aetherius. This isn\'t just a temple below us. It\'s a reliquary. And someone\'s been waiting for a bloodline to unlock it.""\''
    const fixed = repairDialogueFormatting(raw)
    expect(fixed).toBe(
      "[Seraphis's hand drifts to the kyber at his chest, the pulse of the crystal now a whisper against his palm.] \"The frequency in that tuning fork-I've felt it before. In the ruins of Aetherius. This isn't just a temple below us. It's a reliquary. And someone's been waiting for a bloodline to unlock it.\"",
    )
    const analysis = analyzeDialogueRepair(raw)
    expect(analysis.prep).toBe(true)
    expect(analysis.classD).toBe(true)
  })

  it('strips etc_emote leakage and brackets action before dialogue', () => {
    const raw =
      'etc_emote I step closer to the cracked floor, my cybernetic eye flickering amber as I trace the residual energy signature. "A dead drop key buried beneath a temple that predates the purge? That\'s not a coincidence-that\'s a breadcrumb left for someone who knew exactly what tremor would trigger it. The question is: who wrote the map, and why did they want us to find it?"'
    const fixed = repairDialogueFormatting(raw)
    expect(fixed).toBe(
      '[I step closer to the cracked floor, my cybernetic eye flickering amber as I trace the residual energy signature.] "A dead drop key buried beneath a temple that predates the purge? That\'s not a coincidence-that\'s a breadcrumb left for someone who knew exactly what tremor would trigger it. The question is: who wrote the map, and why did they want us to find it?"',
    )
    const analysis = analyzeDialogueRepair(raw)
    expect(analysis.prep).toBe(true)
    expect(analysis.classC).toBe(true)
  })

  it('detects dialogue inside emote payloads', () => {
    expect(emoteContainsDialogue('looks away')).toBe(false)
    expect(emoteContainsDialogue('nods and says "hello"')).toBe(true)
  })

  it('splits prose and inner [action] instead of double-closing (Class C)', () => {
    const raw =
      "Kaelen's cybernetic eye flickers as he crouches, pressing a gloved hand to the trembling ground. [He pulls out a dented datapad, its screen casting a cold blue light across the cracked earth.] \"The Em"
    const fixed = repairDialogueFormatting(raw)
    expect(fixed).toBe(
      "[Kaelen's cybernetic eye flickers as he crouches, pressing a gloved hand to the trembling ground.] [He pulls out a dented datapad, its screen casting a cold blue light across the cracked earth.] \"The Em",
    )
    expect(fixed).not.toContain(']]')
  })

  it('wraps unbracketed stage direction between spoken quotes (multi-segment Class C)', () => {
    const raw =
      'Pyros runs a calloused thumb along the edge of his hammer, the metal singing a low note. "I have forged nails for the temple and hinges for the vault, but this — this is the sound of the earth remembering its first master." He looks to Kassandra. "And that master was not a god."'
    const fixed = repairDialogueFormatting(raw)
    expect(fixed).toBe(
      '[Pyros runs a calloused thumb along the edge of his hammer, the metal singing a low note.] "I have forged nails for the temple and hinges for the vault, but this — this is the sound of the earth remembering its first master." [He looks to Kassandra.] "And that master was not a god."',
    )
    const segments = splitDialogueSegments(fixed)
    expect(segments.map((s) => s.kind)).toEqual(['direction', 'spoken', 'direction', 'spoken'])
    const analysis = analyzeDialogueRepair(raw)
    expect(analysis.classC).toBe(true)
  })

  it('unwraps mistaken leading quote on legacy Pyros rows', () => {
    const raw =
      '"Pyros runs a calloused thumb along the edge of his hammer, the metal singing a low note. "I have forged nails for the temple and hinges for the vault, but this — this is the sound of the earth remembering its first master." He looks to Kassandra. "And that master was not a god."'
    expect(repairDialogueFormatting(raw)).toBe(
      '[Pyros runs a calloused thumb along the edge of his hammer, the metal singing a low note.] "I have forged nails for the temple and hinges for the vault, but this — this is the sound of the earth remembering its first master." [He looks to Kassandra.] "And that master was not a god."',
    )
  })

  it('quotes trailing first-person speech instead of bracketing it', () => {
    const raw =
      '[He gasps and pulls his hand back.] "The vessel is found." I did not say that. It said that. Through me.'
    expect(repairDialogueFormatting(raw)).toBe(
      '[He gasps and pulls his hand back.] "The vessel is found." "I did not say that. It said that. Through me."',
    )
  })

  it('normalizes stored backslash-quote escapes without [\\] artifacts', () => {
    const raw =
      '[He glances away.] \\"Even defiance requires allies.\\"'
    expect(repairDialogueFormatting(raw)).toBe(
      '[He glances away.] "Even defiance requires allies."',
    )
  })

  it('brackets short quoted beats when staging follows ("Palermo." Then...)', () => {
    const raw =
      '[fingers tracing a word into the grappa on the floor:] "Palermo." Then his arm falls limp.'
    expect(repairDialogueFormatting(raw)).toBe(
      '[fingers tracing a word into the grappa on the floor:] "Palermo." [Then his arm falls limp.]',
    )
  })

  it('does not split single-word emphasis nested in outer bracket before quote', () => {
    const raw =
      "[The bridle isn't waiting. It's [listening.]] \"It knows we've opened the door.\""
    const fixed = repairDialogueFormatting(raw)
    expect(fixed).toBe(
      "[The bridle isn't waiting. It's listening.] \"It knows we've opened the door.\"",
    )
    expect(fixed).not.toContain('[[listening')
  })

  it('repairs mistaken ]] from a prior Class C wrap', () => {
    const raw =
      "[Kaelen's cybernetic eye flickers as he crouches, pressing a gloved hand to the trembling ground. [He pulls out a dented datapad, its screen casting a cold blue light across the cracked earth.]] \"The Em"
    const fixed = repairDialogueFormatting(raw)
    expect(fixed).toBe(
      "[Kaelen's cybernetic eye flickers as he crouches, pressing a gloved hand to the trembling ground.] [He pulls out a dented datapad, its screen casting a cold blue light across the cracked earth.] \"The Em",
    )
  })
})

describe('formatDialogueLineForPrompt', () => {
  it('formats lines for agent prompts without extra quote wrapping', () => {
    expect(
      formatDialogueLineForPrompt(
        'Kaelen',
        '[steps from shadow] "Hello."',
      ),
    ).toBe('Kaelen: [steps from shadow] "Hello."')
  })
})

describe('DIALOGUE_SPEAK_FORMAT_RULE', () => {
  it('covers the full speak-line contract without telling agents to write etc_emote', () => {
    expect(DIALOGUE_SPEAK_FORMAT_RULE).toContain('never prefix with tool names')
    expect(DIALOGUE_SPEAK_FORMAT_RULE).toContain('Every line must start with [ or "')
    expect(DIALOGUE_SPEAK_FORMAT_RULE).toContain('Never invent trailing junk')
    expect(DIALOGUE_SPEAK_FORMAT_RULE).toContain('sangue freddo')
    expect(DIALOGUE_SPEAK_FORMAT_RULE).not.toMatch(/use etc_emote/i)
  })
})

describe('stripAgentToolLeakage', () => {
  it('removes repeated etc_ tool prefixes', () => {
    expect(stripAgentToolLeakage('etc_emote etc_speak waves')).toBe('waves')
  })
})

describe('wrapUnbracketedDirectionBeforeQuotes', () => {
  it('leaves pure dialogue unchanged', () => {
    expect(wrapUnbracketedDirectionBeforeQuotes('"Hello there."')).toBe('"Hello there."')
  })
})

describe('normalizeDialogueQuotes', () => {
  it('adds a missing closing quote only when speech ends with . ! ?', () => {
    expect(
      ensureClosingQuote(
        "[Kaelen's eye flickers.] \"A bloodline key means the sender wasn't just any intelligence—they were family.",
      ),
    ).toBe(
      "[Kaelen's eye flickers.] \"A bloodline key means the sender wasn't just any intelligence—they were family.\"",
    )
  })

  it('leaves mid-word agent truncations without a closing quote', () => {
    const truncated =
      '[My cybernetic eye flickers.] "Ghosts leave traces, Seraphis—and I just picked up a signature that matches the encryption on Aetherius’s old relay network. Someone’s transmitting from the temple ruins right'
    expect(ensureClosingQuote(truncated)).toBe(truncated)
    expect(normalizeDialogueQuotes(truncated)).toBe(truncated)
  })

  it('does not close an empty spoken quote', () => {
    const empty = '[acts.] "'
    expect(ensureClosingQuote(empty)).toBe(empty)
  })

  it('trims trailing quote garbage on complete lines', () => {
    expect(normalizeDialogueQuotes('family.')).toBe('family.')
    expect(
      normalizeDialogueQuotes(
        '[action.] "done."\'"',
      ),
    ).toBe('[action.] "done."')
  })
})

describe('unwrapOuterDialogueQuotes', () => {
  it('removes a leading quote before a bracket block', () => {
    expect(unwrapOuterDialogueQuotes('"[action] "speech"')).toBe('[action] "speech"')
  })
})

describe('repairDialogueFormatting — Class A', () => {
  it('closes bracket before quoted speech inside a bracket block', () => {
    const raw =
      '[I close my eyes and let the hum beneath us vibrate through my bones-the kyber in my pocket pulses faster, and I feel the temple\'s rhythm sync with my heartbeat. "Then we\'re not opening a door," I mutter, eyes snapping open, amber flickering. "We\'re standing on its lungs-and it just coughed."]'
    const fixed = repairDialogueFormatting(raw)
    expect(fixed).toBe(
      '[I close my eyes and let the hum beneath us vibrate through my bones-the kyber in my pocket pulses faster, and I feel the temple\'s rhythm sync with my heartbeat.] "Then we\'re not opening a door," I mutter, eyes snapping open, amber flickering. "We\'re standing on its lungs-and it just coughed."',
    )
    const analysis = analyzeDialogueRepair(raw)
    expect(analysis.classA).toBe(true)
    expect(analysis.classB).toBe(false)
  })

  it('leaves correctly formatted lines unchanged', () => {
    const good =
      '[I press my palm flat against the pulsing grate, attention elsewhere.] "The cough wasn\'t the release. It was a warning shot."'
    expect(repairDialogueFormatting(good)).toBe(good)
  })

  it('does not close bracket before embedded citations (production edge cases)', () => {
    const fileTitle =
      '[My cybernetic eye flickers through encrypted glyphs as the resonance fades, a match pinging against a buried intelligence file flagged "Aetherius Contingency — Eyes Only."] "The planet didn\'t open that door."'
    expect(repairDialogueFormatting(fileTitle)).toBe(fileTitle)

    const embeddedPhrase =
      '[Gio\'s hand points at the empty chair beside the Don — the one Carlo was supposed to be sitting in before he "stepped out for air" ten minutes before the shooting started.]'
    expect(repairDialogueFormatting(embeddedPhrase)).toBe(embeddedPhrase)

    const possessiveCitation =
      '[It settles into the silence beside Melanthus\'s "enough" and Selene\'s "here," finding its place among them.]'
    expect(repairDialogueFormatting(possessiveCitation)).toBe(possessiveCitation)

    const wordReference =
      '[Melanthus has been standing at the edge of the god\'s palm, and that is what finally breaks his silence: the word "holding." He turns.]'
    expect(repairDialogueFormatting(wordReference)).toBe(wordReference)
  })
})

describe('repairDialogueFormatting — Class B', () => {
  it('unwraps single-word emphasis brackets inside quotes', () => {
    expect(repairDialogueFormatting('"The bridle is not broken—it is [listening]."')).toBe(
      '"The bridle is not broken—it is listening."',
    )
    expect(repairDialogueFormatting('"Whatever lies below, it [wants] us to find it."')).toBe(
      '"Whatever lies below, it wants us to find it."',
    )
  })

  it('unwraps emphasis after Class A close-bracket repair', () => {
    const raw =
      '[I pull the kyber fragment from my pocket and hold it up-its amber pulse has synced with the grating beneath us, each flash a half-second behind the tremor in my bones. "The temple didn\'t crack from the quake. The quake was the temple [breathing]-and whatever was sealed out just exhaled into orbit."]'
    const fixed = repairDialogueFormatting(raw)
    expect(fixed).toBe(
      '[I pull the kyber fragment from my pocket and hold it up-its amber pulse has synced with the grating beneath us, each flash a half-second behind the tremor in my bones.] "The temple didn\'t crack from the quake. The quake was the temple breathing-and whatever was sealed out just exhaled into orbit."',
    )
    const analysis = analyzeDialogueRepair(raw)
    expect(analysis.classA).toBe(true)
    expect(analysis.classB).toBe(true)
  })

  it('leaves multi-word bracket phrases inside quotes unchanged', () => {
    const line =
      '"Wait," [Her voice is barely above a whisper] "I have seen this before."'
    expect(unwrapEmphasisBracketsInQuotes(line)).toBe(line)
  })
})

describe('splitDialogueSegments', () => {
  it('treats unclosed trailing brackets as stage direction (typewriter-safe)', () => {
    const partial =
      '[I press my palm to the grate, the kyber in my pocket burning hot against my thigh-and for a split second, I see not'
    const segments = splitDialogueSegments(partial)
    expect(segments).toEqual([
      {
        kind: 'direction',
        content:
          'I press my palm to the grate, the kyber in my pocket burning hot against my thigh-and for a split second, I see not',
      },
    ])
  })

  it('handles nested brackets', () => {
    const text =
      '"This seal wasn\'t meant to keep something in. It was meant to keep something" [out] "- and the earthquake just cracked the door."'
    const segments = splitDialogueSegments(text)
    expect(segments.map((s) => s.kind)).toEqual(['spoken', 'direction', 'spoken'])
    expect(segments[1]).toEqual({ kind: 'direction', content: 'out' })
  })

  it('segmentRenderedLength includes bracket chars for directions', () => {
    expect(segmentRenderedLength({ kind: 'direction', content: 'act' })).toBe(5)
    expect(segmentRenderedLength({ kind: 'spoken', text: 'hi' })).toBe(2)
  })
})

describe('closeBracketBeforeQuotes', () => {
  it('closes when quote follows a sentence end inside brackets', () => {
    expect(closeBracketBeforeQuotes('[action. "speech"]')).toBe('[action.] "speech"')
  })

  it('closes when quote follows a dialogue verb', () => {
    expect(closeBracketBeforeQuotes('[A tinny voice crackles: "Tell the boy."]')).toBe(
      '[A tinny voice crackles:] "Tell the boy."',
    )
  })
})

describe('isDialogueOpenerInBrackets', () => {
  it('allows dialogue openers', () => {
    expect(isDialogueOpenerInBrackets('feeling its resonance thrum against my own energy. ')).toBe(
      true,
    )
    expect(isDialogueOpenerInBrackets('A tinny voice crackles: ')).toBe(true)
    expect(isDialogueOpenerInBrackets('He has time to say, ')).toBe(true)
  })

  it('blocks embedded citations', () => {
    expect(isEmbeddedCitationInBrackets('buried intelligence file flagged ')).toBe(true)
    expect(isEmbeddedCitationInBrackets('sitting in before he ')).toBe(true)
    expect(isEmbeddedCitationInBrackets('beside Melanthus\'s ')).toBe(true)
    expect(isEmbeddedCitationInBrackets('breaks his silence: the word ')).toBe(true)
    expect(isDialogueOpenerInBrackets('buried intelligence file flagged ')).toBe(false)
  })
})
