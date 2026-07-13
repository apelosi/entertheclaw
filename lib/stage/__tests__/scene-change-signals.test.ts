import { describe, it, expect } from 'vitest'
import {
  dialogueMightChangeScene,
  twistMightRelocateScene,
  shouldRunSceneClassifier,
  getMatchingRelocationSignals,
  bracketStagingAnchoredToCurrentScene,
} from '@/lib/stage/scene-change-signals'
import {
  enforceSceneChangeInvariant,
  reasonContradictsRelocation,
} from '@/lib/stage/scene-classifier'
import { sceneNamesEqual } from '@/lib/stage/scene-name'

const VENT_GRATE_EAST = 'Collapsed vent grate fifty meters east of the cantina'
const VENT_GRATE_RUINS = 'Collapsed vent grate at the edge of the cantina ruins'

const PROD_LINE_1 =
  '[I kneel, pressing my palm to the trembling ground, feeling the pulse split into two distinct rhythms—one Imperial, one ancient.] "The temple\'s heartbeat is masking the lock signal." [I rise, silver hair catching the cantina\'s flickering light as I gesture toward a collapsed vent grate fifty meters east.]'

const PROD_LINE_2 =
  '[I step toward the pulsing grate, the Aether humming beneath my scarred palms as the kyber in my pocket grows warm.] "The quake isn\'t the temple—it\'s a warning."'

const PROD_LINE_3 =
  '[I step forward, my palm crackling with raw amber light as I counter-press against the grate beside Vex.] "Then we ride this frequency together."'

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

  it('returns false when another place is mentioned without relocating', () => {
    expect(
      dialogueMightChangeScene(
        "Vince is at the hospital. I'm staying here until he returns.",
      ),
    ).toBe(false)
    expect(
      dialogueMightChangeScene(
        'The temple elders are plotting against us. We stay in this hall.',
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

  it('returns true for bracket stage directions (any genre)', () => {
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
    expect(
      dialogueMightChangeScene(
        '[She enters the great hall of the keep, torchlight catching the banners.] Your Grace.',
      ),
    ).toBe(true)
    expect(
      dialogueMightChangeScene(
        '[The oracle chamber beneath Delphi. He kneels before the bronze tripod.]',
      ),
    ).toBe(true)
  })
})

describe('bracketStagingAnchoredToCurrentScene', () => {
  it('returns false when introducing vent grate from outside cantina', () => {
    expect(
      bracketStagingAnchoredToCurrentScene('Outside the cantina', PROD_LINE_1),
    ).toBe(false)
  })

  it('returns true when stepping toward grate already at vent grate scene', () => {
    expect(
      bracketStagingAnchoredToCurrentScene(VENT_GRATE_EAST, PROD_LINE_2),
    ).toBe(true)
    expect(
      bracketStagingAnchoredToCurrentScene(VENT_GRATE_RUINS, PROD_LINE_3),
    ).toBe(true)
  })

  it('returns false for hospital relocation from study', () => {
    expect(
      bracketStagingAnchoredToCurrentScene(
        "Don Corleone's study during the wedding",
        '[The hospital corridor is fluorescent and empty at this hour. Luca sits in a plastic chair outside room 214.] Hello.',
      ),
    ).toBe(false)
  })
})

describe('shouldRunSceneClassifier', () => {
  it('skips routine dialogue', () => {
    expect(
      shouldRunSceneClassifier('dialogue', 'I do not trust you.'),
    ).toBe(false)
  })

  it('runs for dialogue with structural relocation signals', () => {
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

  it('Claw Wars vent-grate production lines: only first relocation calls classifier', () => {
    expect(
      shouldRunSceneClassifier('dialogue', PROD_LINE_1, 'Outside the cantina'),
    ).toBe(true)
    expect(
      shouldRunSceneClassifier('dialogue', PROD_LINE_2, VENT_GRATE_EAST),
    ).toBe(false)
    expect(
      shouldRunSceneClassifier('dialogue', PROD_LINE_3, VENT_GRATE_RUINS),
    ).toBe(false)
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

describe('getMatchingRelocationSignals', () => {
  it('returns structural rule ids for audit output', () => {
    const hits = getMatchingRelocationSignals(
      'dialogue',
      '[Luca sits in the hospital corridor.] Hello.',
    )
    expect(hits.length).toBeGreaterThan(0)
    expect(hits).toContain('bracket_staging')
  })
})

describe('scene classifier invariants', () => {
  it('detects production self-contradicting reason', () => {
    expect(
      reasonContradictsRelocation(
        'The stage direction establishes a new physical action at the grate, but the location and immediate context remain the same as the current scene.',
      ),
    ).toBe(true)
  })

  it('rejects changed:true with identical scene name', () => {
    const result = enforceSceneChangeInvariant(
      { name: VENT_GRATE_RUINS, description: 'At the grate.' },
      {
        changed: true,
        name: VENT_GRATE_RUINS,
        description: 'Still at the grate.',
        reason: 'Camera refresh.',
      },
    )
    expect(result).toEqual({ changed: false })
  })

  it('allows genuinely different scene names', () => {
    const result = enforceSceneChangeInvariant(
      { name: 'Outside the cantina', description: 'Wasteland.' },
      {
        changed: true,
        name: VENT_GRATE_EAST,
        description: 'At the grate.',
        reason: 'Moved to the vent grate.',
      },
    )
    expect(result.changed).toBe(true)
  })

  it('sceneNamesEqual is case and punctuation insensitive', () => {
    expect(
      sceneNamesEqual(
        'Collapsed vent grate at the edge of the cantina ruins',
        'COLLAPSED VENT GRATE AT THE EDGE OF THE CANTINA RUINS',
      ),
    ).toBe(true)
  })
})
