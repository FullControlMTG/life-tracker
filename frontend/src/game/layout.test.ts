import { describe, expect, it } from 'vitest'

import {
  LAYOUTS,
  edgeGuardSides,
  facingOrder,
  layoutById,
  localSideFacing,
  screenEdges,
  seatCount,
  seatRects,
} from './layout'
import type { Facing, LayoutNode } from './layout'

interface Rect {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** An independent re-derivation of the seat rectangles, kept separate from the
 *  implementation on purpose: if both used the same code a bad edit would pass. */
function seatRectsOracle(node: LayoutNode, box: Rect = { x0: 0, y0: 0, x1: 1, y1: 1 }): {
  facing: Facing
  rect: Rect
}[] {
  if (node.kind === 'seat') return [{ facing: node.facing, rect: box }]

  const weights = node.children.map((_, i) => node.weights?.[i] ?? 1)
  const total = weights.reduce((a, b) => a + b, 0)
  const out: { facing: Facing; rect: Rect }[] = []

  let offset = 0
  node.children.forEach((child, i) => {
    const share = weights[i] / total
    const childBox =
      node.dir === 'row'
        ? {
            x0: box.x0 + (box.x1 - box.x0) * offset,
            x1: box.x0 + (box.x1 - box.x0) * (offset + share),
            y0: box.y0,
            y1: box.y1,
          }
        : {
            x0: box.x0,
            x1: box.x1,
            y0: box.y0 + (box.y1 - box.y0) * offset,
            y1: box.y0 + (box.y1 - box.y0) * (offset + share),
          }
    out.push(...seatRectsOracle(child, childBox))
    offset += share
  })
  return out
}

const EPS = 1e-9

describe('layout presets', () => {
  it.each(LAYOUTS)('$id has exactly $players seats', (preset) => {
    expect(seatCount(preset.root)).toBe(preset.players)
    expect(facingOrder(preset.root)).toHaveLength(preset.players)
  })

  // This is the rule the whole design rests on: a seat faces the edge its
  // player sits at, so an interior rectangle would have no edge to face.
  it.each(LAYOUTS)('$id: every seat touches the edge it faces', (preset) => {
    for (const { facing, rect } of seatRectsOracle(preset.root)) {
      const touches = {
        left: rect.x0 <= EPS,
        right: rect.x1 >= 1 - EPS,
        top: rect.y0 <= EPS,
        bottom: rect.y1 >= 1 - EPS,
      }
      expect(touches[facing], `${preset.id}: a ${facing}-facing seat is not against the ${facing} edge`).toBe(true)
    }
  })

  it.each(LAYOUTS)('$id: seats tile the screen without overlapping', (preset) => {
    const rects = seatRectsOracle(preset.root).map((s) => s.rect)

    const area = rects.reduce((sum, r) => sum + (r.x1 - r.x0) * (r.y1 - r.y0), 0)
    expect(area).toBeCloseTo(1, 6)

    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]
        const b = rects[j]
        const overlaps =
          a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.y0 < b.y1 - EPS && b.y0 < a.y1 - EPS
        expect(overlaps, `${preset.id}: seats ${i + 1} and ${j + 1} overlap`).toBe(false)
      }
    }
  })

  it('offers at least one layout for every supported player count', () => {
    for (let n = 1; n <= 6; n++) {
      expect(LAYOUTS.filter((l) => l.players === n).length).toBeGreaterThan(0)
    }
  })

  it('has unique preset ids', () => {
    const ids = LAYOUTS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('screen-edge guards', () => {
  it('reports which screen edges a seat is flush against', () => {
    expect(screenEdges({ x0: 0, y0: 0, x1: 1, y1: 1 }).sort())
      .toEqual(['bottom', 'left', 'right', 'top'])
    expect(screenEdges({ x0: 0, y0: 0, x1: 0.5, y1: 1 }).sort())
      .toEqual(['bottom', 'left', 'top'])
    expect(screenEdges({ x0: 0.25, y0: 0.25, x1: 0.75, y1: 0.75 })).toEqual([])
  })

  // A quarter turn clockwise sends local "left" to the top of the screen.
  it.each([
    [0, 'top'],
    [90, 'left'],
    [180, 'bottom'],
    [270, 'right'],
  ] as const)('at %i degrees the screen top is the local %s', (rotation, expected) => {
    expect(localSideFacing('top', rotation)).toBe(expected)
  })

  it('is a bijection at every rotation, so no side is guarded twice', () => {
    for (const rotation of [0, 90, 180, 270]) {
      const mapped = (['top', 'right', 'bottom', 'left'] as const).map((e) => localSideFacing(e, rotation))
      expect(new Set(mapped).size).toBe(4)
    }
  })

  it('guards the local side that carries the header when it sits at the screen top', () => {
    // A full-screen solo seat faces the bottom, so its header is at the screen top.
    const solo = layoutById('1p')!
    const [rect] = seatRects(solo.root)
    expect(edgeGuardSides(rect, 'bottom')).toContain('top')
  })

  it.each(LAYOUTS)('$id: seat rects agree with the facing invariant', (preset) => {
    const rects = seatRects(preset.root)
    const facings = facingOrder(preset.root)
    expect(rects).toHaveLength(facings.length)
    rects.forEach((rect, i) => {
      expect(screenEdges(rect), `seat ${i + 1} faces ${facings[i]}`).toContain(facings[i])
    })
  })

  it('guards every seat that touches an edge, and only those', () => {
    for (const preset of LAYOUTS) {
      const rects = seatRects(preset.root)
      const facings = facingOrder(preset.root)
      rects.forEach((rect, i) => {
        const guards = edgeGuardSides(rect, facings[i])
        expect(guards.length).toBe(screenEdges(rect).length)
        expect(guards.length).toBeGreaterThan(0) // the layout invariant guarantees this
      })
    }
  })
})
