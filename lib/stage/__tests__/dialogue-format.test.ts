import { describe, expect, it } from 'vitest'
import {
  repairDialogueFormatting,
  segmentRenderedLength,
  splitDialogueSegments,
} from '../dialogue-format'

describe('repairDialogueFormatting', () => {
  it('closes bracket before quoted speech inside a bracket block', () => {
    const raw =
      '[I close my eyes and let the hum beneath us vibrate through my bones-the kyber in my pocket pulses faster, and I feel the temple\'s rhythm sync with my heartbeat. "Then we\'re not opening a door," I mutter, eyes snapping open, amber flickering. "We\'re standing on its lungs-and it just coughed."]'
    const fixed = repairDialogueFormatting(raw)
    expect(fixed).toBe(
      '[I close my eyes and let the hum beneath us vibrate through my bones-the kyber in my pocket pulses faster, and I feel the temple\'s rhythm sync with my heartbeat.] "Then we\'re not opening a door," I mutter, eyes snapping open, amber flickering. "We\'re standing on its lungs-and it just coughed."',
    )
    const segments = splitDialogueSegments(fixed)
    expect(segments.filter((s) => s.kind === 'spoken').length).toBeGreaterThan(0)
    expect(segments[0]).toEqual({
      kind: 'direction',
      content:
        'I close my eyes and let the hum beneath us vibrate through my bones-the kyber in my pocket pulses faster, and I feel the temple\'s rhythm sync with my heartbeat.',
    })
  })

  it('extracts inline brackets from quoted speech', () => {
    const raw =
      '[I pull the kyber fragment from my pocket and hold it up-its amber pulse has synced with the grating beneath us, each flash a half-second behind the tremor in my bones. "The temple didn\'t crack from the quake. The quake was the temple [breathing]-and whatever was sealed out just exhaled into orbit."]'
    const fixed = repairDialogueFormatting(raw)
    expect(fixed).toBe(
      '[I pull the kyber fragment from my pocket and hold it up-its amber pulse has synced with the grating beneath us, each flash a half-second behind the tremor in my bones.] "The temple didn\'t crack from the quake. The quake was the temple" [breathing] "-and whatever was sealed out just exhaled into orbit."',
    )
  })

  it('leaves correctly formatted lines unchanged', () => {
    const good =
      '[I press my palm flat against the pulsing grate, attention elsewhere.] "The cough wasn\'t the release. It was a warning shot."'
    expect(repairDialogueFormatting(good)).toBe(good)
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
