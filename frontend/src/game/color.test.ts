import { describe, expect, it } from 'vitest'

import { hexToHsl, hslToHex, isHex, readableInk } from './color'

describe('colour', () => {
  it('round-trips hex through hsl within rounding tolerance', () => {
    for (const hex of ['#3b82f6', '#000000', '#ffffff', '#7f1d1d', '#14b8a6']) {
      const back = hslToHex(hexToHsl(hex))
      const diff = [0, 1, 2].map(
        (i) =>
          Math.abs(
            parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) -
              parseInt(back.slice(1 + i * 2, 3 + i * 2), 16),
          ),
      )
      expect(Math.max(...diff), `${hex} -> ${back}`).toBeLessThanOrEqual(3)
    }
  })

  it('picks dark ink on light seats and light ink on dark ones', () => {
    expect(readableInk('#ffffff')).toBe('#0f172a')
    expect(readableInk('#fde047')).toBe('#0f172a')
    expect(readableInk('#0b1220')).toBe('#f8fafc')
    expect(readableInk('#7f1d1d')).toBe('#f8fafc')
  })

  it('validates six-digit hex only', () => {
    expect(isHex('#3b82f6')).toBe(true)
    expect(isHex('#3B82F6')).toBe(true)
    expect(isHex('#abc')).toBe(false)
    expect(isHex('3b82f6')).toBe(false)
    expect(isHex('#zzzzzz')).toBe(false)
  })
})
