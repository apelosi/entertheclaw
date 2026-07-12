import { describe, it, expect } from 'vitest'
import {
  dialogueMightChangeScene,
  twistMightRelocateScene,
  shouldRunSceneClassifier,
  getMatchingRelocationSignals,
} from '@/lib/stage/scene-change-signals'

describe('dialogueMightChangeScene', () => {
  it('returns false for routine in-character chatter', () => {
    expect(dialogueMightChangeScene('I do not trust you.')).toBe(false)
    expect(
      dialogueMightChangeScene(
        'Then you know more than you should.',
      ),
    ).toBe(false)
    expect(
      dialogueMightChangeScene(
        'I do not know what you expect me to say about that.',
      ),
    ).toBe(false)
  })

  it('returns true for explicit travel or hard cuts', () => {
    expect(dialogueMightChangeScene('We arrive at the gas station.')).toBe(
      true,
    )
    expect(dialogueMightChangeScene('Cut to the kitchen at dawn.')).toBe(true)
    expect(dialogueMightChangeScene('Hours later, we are in the cellar.')).toBe(
      true,
    )
    expect(
      dialogueMightChangeScene('*enters the throne room* Your Majesty.'),
    ).toBe(true)
  })

  it('returns true for Clawfather-style bracket stage directions', () => {
    expect(
      dialogueMightChangeScene(
        '[The hospital corridor is fluorescent and empty at this hour. Luca sits in a plastic chair outside room 214.] You never did learn to ask for help, did you, Popà.',
      ),
    ).toBe(true)
    expect(
      dialogueMightChangeScene(
        "[Luca stands in his father's empty bedroom. The bed is made.]",
      ),
    ).toBe(true)
    expect(
      dialogueMightChangeScene(
        '[Dawn on the docks. Luca stands at the railing.] Last stop.',
      ),
    ).toBe(true)
  })
})

describe('twistMightRelocateScene', () => {
  it('returns false for emotional beats without relocation', () => {
    expect(
      twistMightRelocateScene(
        'A messenger collapses at the gate bearing a sealed letter for the King.',
      ),
    ).toBe(false)
    expect(
      twistMightRelocateScene('The Duke reveals he has been lying all along.'),
    ).toBe(false)
  })

  it('returns true for explicit director relocations', () => {
    expect(
      twistMightRelocateScene('Scene changes to the highway shoulder at dusk.'),
    ).toBe(true)
    expect(twistMightRelocateScene("Cut to Arthur's kitchen, dawn.")).toBe(
      true,
    )
  })

  it('returns true for implicit relocation cues', () => {
    expect(
      twistMightRelocateScene(
        'The building explodes. Everyone runs into the street.',
      ),
    ).toBe(true)
    expect(
      twistMightRelocateScene('The roof collapses into the courtyard below.'),
    ).toBe(true)
    expect(
      twistMightRelocateScene('Suddenly at the hospital waiting room.'),
    ).toBe(true)
  })
})

describe('shouldRunSceneClassifier', () => {
  it('skips routine dialogue', () => {
    expect(
      shouldRunSceneClassifier('dialogue', 'I do not trust you.'),
    ).toBe(false)
  })

  it('runs for dialogue with relocation signals', () => {
    expect(
      shouldRunSceneClassifier('dialogue', 'We walk into the warehouse.'),
    ).toBe(true)
  })

  it('skips non-relocating twists', () => {
    expect(
      shouldRunSceneClassifier(
        'twist',
        'Thunder rolls; the lights flicker out.',
      ),
    ).toBe(false)
  })

  it('runs for relocating twists', () => {
    expect(
      shouldRunSceneClassifier(
        'twist',
        'Scene changes to the moonlit balcony.',
      ),
    ).toBe(true)
  })
})

describe('getMatchingRelocationSignals', () => {
  it('returns rule ids for audit output', () => {
    const hits = getMatchingRelocationSignals(
      'dialogue',
      '[Luca sits in the hospital corridor.] Hello.',
    )
    expect(hits.length).toBeGreaterThan(0)
    expect(hits).toContain('bracket_named_place')
  })
})
