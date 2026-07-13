import { describe, expect, it } from 'vitest'
import {
  analyzeDialogueRepair,
  closeBracketBeforeQuotes,
  isEmphasisBracket,
  normalizeStageDirectionMarkers,
  repairDialogueFormatting,
  segmentRenderedLength,
  splitDialogueSegments,
  unwrapEmphasisBracketsInQuotes,
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
  it('is exported for repair analysis', () => {
    expect(closeBracketBeforeQuotes('[action "speech"]')).toBe('[action] "speech"')
  })
})
