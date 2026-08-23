import { describe, expect, it } from 'vitest'

import { axisRatio } from './geometry'

const ORIGIN = { x: 0, y: 0 }

describe('axisRatio', () => {
  // One case per seat facing: the track is rotated with the seat menu, so the
  // same visual drag arrives as a different screen-space direction.
  it.each([
    ['bottom  0deg, axis points right', { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 25, y: 0 }],
    ['left   90deg, axis points down', { x: 0, y: 0 }, { x: 0, y: 100 }, { x: 0, y: 25 }],
    ['top   180deg, axis points left', { x: 100, y: 0 }, { x: 0, y: 0 }, { x: 75, y: 0 }],
    ['right 270deg, axis points up', { x: 0, y: 100 }, { x: 0, y: 0 }, { x: 0, y: 75 }],
  ])('%s', (_label, a, b, p) => {
    expect(axisRatio(p, a, b)).toBeCloseTo(0.25, 6)
  })

  it('ignores movement perpendicular to the track', () => {
    const a = { x: 0, y: 0 }
    const b = { x: 100, y: 0 }
    expect(axisRatio({ x: 40, y: 500 }, a, b)).toBeCloseTo(0.4, 6)
    expect(axisRatio({ x: 40, y: -500 }, a, b)).toBeCloseTo(0.4, 6)
  })

  it('clamps past either end', () => {
    const a = { x: 0, y: 0 }
    const b = { x: 100, y: 0 }
    expect(axisRatio({ x: -80, y: 0 }, a, b)).toBe(0)
    expect(axisRatio({ x: 900, y: 0 }, a, b)).toBe(1)
  })

  it('handles a diagonal axis', () => {
    expect(axisRatio({ x: 5, y: 5 }, ORIGIN, { x: 10, y: 10 })).toBeCloseTo(0.5, 6)
  })

  it('returns 0 for a zero-length track rather than dividing by zero', () => {
    expect(axisRatio({ x: 3, y: 3 }, ORIGIN, ORIGIN)).toBe(0)
  })
})
