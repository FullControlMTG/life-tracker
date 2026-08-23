import { describe, expect, it } from 'vitest'

import { DARK_INK, LIGHT_INK, contrastRatio, hexToHsl, hslToHex, isHex, readableInk, rgbToHex } from './color'

const SEAT_DEFAULTS = ['#1c77e0', '#e5294f', '#118a44', '#a44be9', '#a26e14', '#128495']
const SWATCHES = [...SEAT_DEFAULTS, '#506ee9', '#ce5019']

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
    expect(readableInk('#ffffff')).toBe(DARK_INK)
    expect(readableInk('#fde047')).toBe(DARK_INK)
    expect(readableInk('#0b1220')).toBe(LIGHT_INK)
    expect(readableInk('#7f1d1d')).toBe(LIGHT_INK)
  })

  // The seat colour is user-chosen, so this has to hold for every hex, not just
  // the presets. A fixed threshold used to leave mid-light seats on white text
  // at ~2.3:1.
  it('never leaves any colour below 4:1 against the ink it picks', () => {
    let worst = { hex: '', ratio: Infinity }
    for (let r = 0; r < 256; r += 15) {
      for (let g = 0; g < 256; g += 15) {
        for (let b = 0; b < 256; b += 15) {
          const hex = rgbToHex(r, g, b)
          const ratio = contrastRatio(hex, readableInk(hex))
          if (ratio < worst.ratio) worst = { hex, ratio }
        }
      }
    }
    expect(worst.ratio, `worst case was ${worst.hex} at ${worst.ratio.toFixed(2)}:1`)
      .toBeGreaterThan(4)
  })

  it('always chooses the higher-contrast ink', () => {
    for (const hex of ['#376eae', '#bc3f5e', '#8a52bc', '#6b8fc4', '#8aa9d6', '#a08bbf', '#808080']) {
      const chosen = readableInk(hex)
      const other = chosen === LIGHT_INK ? DARK_INK : LIGHT_INK
      expect(contrastRatio(hex, chosen)).toBeGreaterThanOrEqual(contrastRatio(hex, other))
    }
  })

  // The palettes are duplicated above on purpose - the test is the contract, so
  // importing them would let a bad edit pass silently.
  it('keeps every default vivid', () => {
    for (const hex of SWATCHES) {
      const { s } = hexToHsl(hex)
      expect(s, `${hex} is only ${s}% saturated`).toBeGreaterThanOrEqual(70)
    }
  })

  // Brightness is capped by the ink rule, not by taste: past this point
  // readableInk flips the seat to dark text, which is a different design.
  it('keeps every default bright enough to feel lit, but still on white text', () => {
    for (const hex of SWATCHES) {
      expect(readableInk(hex), `${hex} would flip to dark text`).toBe(LIGHT_INK)
      const ratio = contrastRatio(hex, LIGHT_INK)
      expect(ratio, `${hex} is darker than it needs to be (${ratio.toFixed(2)}:1)`).toBeLessThan(4.5)
      expect(ratio, `${hex} is too light for white text (${ratio.toFixed(2)}:1)`).toBeGreaterThan(4)
    }
  })

  it('gives every seat default the same weight so none reads washed out', () => {
    const ratios = SEAT_DEFAULTS.map((hex) => contrastRatio(hex, LIGHT_INK))
    expect(Math.max(...ratios) - Math.min(...ratios)).toBeLessThan(0.3)
  })

  it('validates six-digit hex only', () => {
    expect(isHex('#3b82f6')).toBe(true)
    expect(isHex('#3B82F6')).toBe(true)
    expect(isHex('#abc')).toBe(false)
    expect(isHex('3b82f6')).toBe(false)
    expect(isHex('#zzzzzz')).toBe(false)
  })
})
