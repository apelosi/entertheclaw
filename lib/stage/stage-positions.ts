/** Map a stage movement angle (0° = right, 90° = up) to normalized 0..1 coords. */
export function angleToNormalizedPosition(angle: number): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180
  const rx = 0.36
  const ry = 0.28
  return {
    x: 0.5 + Math.cos(rad) * rx,
    y: 0.55 - Math.sin(rad) * ry,
  }
}
