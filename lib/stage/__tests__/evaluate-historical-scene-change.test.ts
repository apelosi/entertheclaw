import { describe, it, expect } from 'vitest'
import {
  auditHistoricalSceneChange,
  detectMissedSceneChange,
  scenesAreSameLocation,
} from '@/lib/stage/evaluate-historical-scene-change'

const VENT_EAST = 'Collapsed vent grate fifty meters east of the cantina'
const VENT_RUINS = 'Collapsed vent grate at the edge of the cantina ruins'

const PROD_VEX_LINE =
  '[I step toward the pulsing grate, the Aether humming beneath my scarred palms as the kyber in my pocket grows warm.] "The quake is not the temple."'

const PROD_SERAPHIS_DUP =
  '[I step forward, my palm crackling with raw amber light as I counter-press against the grate beside Vex.] "Then we ride this frequency together."'

const WEDDING =
  "Don Santorelli's study during the wedding, May 22, 2016"
const SHOOTING = "Don Santorelli's study, seconds after the shooting"

describe('auditHistoricalSceneChange', () => {
  it('deletes duplicate vent grate scenes on Claw Wars', () => {
    const rephrase = auditHistoricalSceneChange({
      currentScene: { name: VENT_EAST, description: '' },
      sourceKind: 'dialogue',
      sourceText: PROD_VEX_LINE,
      proposedName: VENT_RUINS,
      proposedDescription: 'At the grate.',
      proposedReason: 'Moves to the pulsing grate.',
    })
    expect(rephrase.keep).toBe(false)
    expect(rephrase.reason).toBe('gate_would_skip')

    const identical = auditHistoricalSceneChange({
      currentScene: { name: VENT_RUINS, description: '' },
      sourceKind: 'dialogue',
      sourceText: PROD_SERAPHIS_DUP,
      proposedName: VENT_RUINS,
      proposedDescription: 'Still at grate.',
      proposedReason:
        'The location and immediate context remain the same as the current scene.',
    })
    expect(identical.keep).toBe(false)
    expect(['identical_scene_name', 'gate_would_skip']).toContain(
      identical.reason,
    )
  })

  it('deletes duplicate Clawfather wedding and shooting scenes', () => {
    const weddingDup = auditHistoricalSceneChange({
      currentScene: { name: WEDDING, description: '' },
      sourceKind: 'dialogue',
      sourceText:
        '[Gio turns to follow Luca gaze—a masked man stands in the doorway.]',
      proposedName: WEDDING,
      proposedDescription: 'Shooting.',
      proposedReason: 'Shooting transforms the scene context.',
    })
    expect(weddingDup.keep).toBe(false)
    expect(weddingDup.reason).toBe('identical_scene_name')

    const shootingDup = auditHistoricalSceneChange({
      currentScene: { name: SHOOTING, description: '' },
      sourceKind: 'dialogue',
      sourceText:
        '[Vince steps forward, his polished shoe nudging Vito aside as he crouches.]',
      proposedName: SHOOTING,
      proposedDescription: 'Still in study.',
      proposedReason:
        'Small movement within the current location, not a change to a new physical setting.',
    })
    expect(shootingDup.keep).toBe(false)
    expect(shootingDup.reason).toBe('identical_scene_name')
  })

  it('keeps first shooting beat and Titans shaft descent', () => {
    const shooting = auditHistoricalSceneChange({
      currentScene: { name: WEDDING, description: '' },
      sourceKind: 'dialogue',
      sourceText:
        "[Vince steps over Gio's body without a glance, his voice low and cold.]",
      proposedName: SHOOTING,
      proposedDescription: 'Aftermath.',
      proposedReason: 'New beat after shooting.',
    })
    expect(shooting.keep).toBe(true)

    const shaft = auditHistoricalSceneChange({
      currentScene: {
        name: 'The subterranean vault beneath the temple, oil lamp guttering',
        description: '',
      },
      sourceKind: 'dialogue',
      sourceText:
        '[Selene steps past Melanthus, her hand trailing along the dagger hilt.] "Let us go find yours." [She drops first into the shaft]',
      proposedName: 'Dark shaft beneath the temple vault, dripping stone passage',
      proposedDescription: 'Below.',
      proposedReason: 'Descends into the shaft.',
    })
    expect(shaft.keep).toBe(true)
  })

  it('deletes Titans vault rephrase when hatch opens in same chamber', () => {
    const vault = auditHistoricalSceneChange({
      currentScene: {
        name: "The bronze chamber beneath the Oracle's steps, dawn",
        description: '',
      },
      sourceKind: 'dialogue',
      sourceText:
        '[She drives the dolphin-headed dagger into the seam Pyros cracked, prying the hatch open.]',
      proposedName: 'The subterranean vault beneath the temple, oil lamp guttering',
      proposedDescription: 'Hatch open.',
      proposedReason: 'Hatch opened revealing shaft.',
    })
    expect(vault.keep).toBe(false)
    expect(vault.reason).toBe('hatch_open_same_room')
  })
})

describe('detectMissedSceneChange', () => {
  it('detects hospital corridor backfill on Clawfather', () => {
    const missed = detectMissedSceneChange(
      { name: WEDDING, description: '' },
      'dialogue',
      '[The hospital corridor is fluorescent and empty at this hour. Luca sits in a plastic chair outside room 214.]',
    )
    expect(missed?.suggestedName).toContain('Hospital corridor')
  })
})

describe('scenesAreSameLocation', () => {
  it('matches vent grate rephrases', () => {
    expect(scenesAreSameLocation(VENT_EAST, VENT_RUINS)).toBe(true)
  })
})
