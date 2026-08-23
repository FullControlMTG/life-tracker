import { describe, expect, it } from 'vitest'

import { D20_FACETS, D20_SILHOUETTE, D20_TOP_FACE } from './d20'

const coords = (points: string) =>
  points.split(' ').map((p) => p.split(',').map(Number) as [number, number])

describe('d20 geometry', () => {
  it('shows ten faces: the top, its ring of three, and six filling the gaps', () => {
    expect(D20_FACETS).toHaveLength(9)
    expect(D20_FACETS.length + 1).toBe(10)
  })

  it('draws every facet as a triangle', () => {
    for (const f of D20_FACETS) expect(coords(f.points)).toHaveLength(3)
    expect(coords(D20_TOP_FACE)).toHaveLength(3)
  })

  it('has a hexagonal silhouette', () => {
    expect(coords(D20_SILHOUETTE)).toHaveLength(6)
  })

  it('stays inside the 100x100 viewBox', () => {
    const all = [...D20_FACETS.map((f) => f.points), D20_TOP_FACE, D20_SILHOUETTE]
    for (const [x, y] of all.flatMap(coords)) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(100)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(100)
    }
  })

  // The number is centred on the top face, so that face has to be centred too.
  it('centres the top face on the icon', () => {
    const pts = coords(D20_TOP_FACE)
    const cx = pts.reduce((a, [x]) => a + x, 0) / 3
    const cy = pts.reduce((a, [, y]) => a + y, 0) / 3
    expect(cx).toBeCloseTo(50, 1)
    expect(cy).toBeCloseTo(50, 1)
  })

  it('is symmetric about the vertical axis', () => {
    const xs = coords(D20_SILHOUETTE).map(([x]) => x).sort((a, b) => a - b)
    for (let i = 0; i < xs.length / 2; i++) {
      expect(xs[i] + xs[xs.length - 1 - i]).toBeCloseTo(100, 1)
    }
  })

  it('shades facets distinctly so the solid reads as 3D', () => {
    const opacities = new Set(D20_FACETS.map((f) => f.opacity))
    expect(opacities.size).toBeGreaterThan(2)
    for (const f of D20_FACETS) {
      expect(f.opacity).toBeGreaterThan(0)
      expect(f.opacity).toBeLessThan(1)
    }
  })
})

// The rolled value is drawn on the top face, so the face has to be wide enough
// to carry it. Width of an equilateral triangle at its centroid is r*2/sqrt(3).
describe('top face fits a rolled value', () => {
  const widthAtCentroid = () => {
    const pts = D20_TOP_FACE.split(' ').map((p) => p.split(',').map(Number))
    const r = Math.hypot(pts[0][0] - 50, pts[0][1] - 50)
    return (r * 2) / Math.sqrt(3)
  }

  // Rough advance width for the rounded numerals used on the die.
  const textWidth = (digits: number, fontSize: number) => digits * fontSize * 0.55

  it.each([
    ['single digit', 1, 32],
    ['two digits', 2, 27],
    ['three digits', 3, 21],
  ])('%s fits across the face', (_label, digits, fontSize) => {
    expect(textWidth(digits, fontSize)).toBeLessThan(widthAtCentroid())
  })
})
