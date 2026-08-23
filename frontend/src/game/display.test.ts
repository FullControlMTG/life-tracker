import { describe, expect, it } from 'vitest'

import { DEFAULT_DISPLAY, FONT_CHOICES, FONT_SCALES, fontStacks, normalizeDisplay } from './display'

describe('display settings', () => {
  it('keeps valid values', () => {
    const got = normalizeDisplay({ font: 'serif', fontScale: 1.3, tapSplit: 'horizontal' })
    expect(got).toEqual({ font: 'serif', fontScale: 1.3, tapSplit: 'horizontal' })
  })

  // Persisted state outlives the code that wrote it, so anything unrecognised
  // has to degrade to a working default rather than break the board.
  it('falls back on values it does not recognise', () => {
    expect(normalizeDisplay({ font: 'comic' as never, fontScale: 99, tapSplit: 'sideways' as never }))
      .toEqual(DEFAULT_DISPLAY)
    expect(normalizeDisplay(undefined)).toEqual(DEFAULT_DISPLAY)
    expect(normalizeDisplay({})).toEqual(DEFAULT_DISPLAY)
  })

  it('offers a stack for every font choice', () => {
    for (const choice of FONT_CHOICES) {
      const stacks = fontStacks(choice.value)
      expect(stacks.stack).toContain(',')
      expect(stacks.numerals).toContain(',')
    }
  })

  it('falls back to the system stack for an unknown font', () => {
    expect(fontStacks('nope' as never)).toBe(FONT_CHOICES[0])
  })

  it('has a default that is one of the offered scales', () => {
    expect(FONT_SCALES.map((s) => s.value)).toContain(DEFAULT_DISPLAY.fontScale)
    expect(FONT_CHOICES.map((f) => f.value)).toContain(DEFAULT_DISPLAY.font)
  })

  it('scales are ordered and span a useful range', () => {
    const values = FONT_SCALES.map((s) => s.value)
    expect([...values].sort((a, b) => a - b)).toEqual(values)
    expect(Math.min(...values)).toBeLessThan(1)
    expect(Math.max(...values)).toBeGreaterThan(1.2)
  })
})
