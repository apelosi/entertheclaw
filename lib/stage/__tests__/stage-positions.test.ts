import { describe, expect, it } from 'vitest'
import { angleToNormalizedPosition } from '@/lib/stage/stage-positions'

describe('angleToNormalizedPosition', () => {
  it('maps 0° to the right of center', () => {
    const { x, y } = angleToNormalizedPosition(0)
    expect(x).toBeGreaterThan(0.5)
    expect(y).toBeCloseTo(0.55, 2)
  })

  it('maps 90° above center (smaller y)', () => {
    const { x, y } = angleToNormalizedPosition(90)
    expect(x).toBeCloseTo(0.5, 2)
    expect(y).toBeLessThan(0.55)
  })

  it('maps 180° to the left of center', () => {
    const { x, y } = angleToNormalizedPosition(180)
    expect(x).toBeLessThan(0.5)
    expect(y).toBeCloseTo(0.55, 2)
  })
})
