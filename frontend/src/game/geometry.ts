export interface Point {
  x: number
  y: number
}

/**
 * How far along the segment a->b the point p falls, clamped to 0..1.
 *
 * Used to map a pointer onto a slider track. `a` and `b` are the track's own
 * endpoints read from the DOM in screen coordinates, so the axis comes from
 * wherever the element actually is - a seat menu rotated a quarter turn drags
 * along screen Y, and this still returns the right value. Movement
 * perpendicular to the track is ignored.
 */
export function axisRatio(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return 0

  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared
  return t < 0 ? 0 : t > 1 ? 1 : t
}
