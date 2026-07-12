import { describe, it, expect } from 'vitest'
import { scenesAreSameLocation } from '@/lib/stage/scene-same-location'

describe('scenesAreSameLocation', () => {
  it('returns true for identical names', () => {
    expect(
      scenesAreSameLocation(
        'Collapsed vent grate at the edge of the cantina ruins',
        'Collapsed vent grate at the edge of the cantina ruins',
      ),
    ).toBe(true)
  })

  it('returns true for same vent-grate location rephrased', () => {
    expect(
      scenesAreSameLocation(
        'Collapsed vent grate at the edge of the cantina ruins',
        'Collapsed vent grate fifty meters east of the cantina',
      ),
    ).toBe(true)
  })

  it('returns false for cantina interior vs outside', () => {
    expect(
      scenesAreSameLocation(
        "Smuggler's cantina on a frontier moon, May 22, 2016",
        'Outside the cantina',
      ),
    ).toBe(false)
  })

  it('returns false for genuinely different locations', () => {
    expect(
      scenesAreSameLocation(
        "Don Corleone's study during the wedding",
        'Hospital corridor outside room 214',
      ),
    ).toBe(false)
  })
})
