import { describe, expect, it } from 'vitest'

import { DICE, MAX_ROLL_COUNT, cryptoRandom, flipCoins, rollDice } from './random'
import type { RandomSource } from './random'

/** Feeds a fixed sequence, so a roll's arithmetic can be checked exactly. */
const scripted = (values: number[]): RandomSource => {
  let i = 0
  return () => values[i++ % values.length]
}

describe('rollDice', () => {
  it('turns zero-based draws into die faces', () => {
    const r = rollDice(6, 3, scripted([0, 5, 2]))
    expect(r.faces).toEqual([1, 6, 3])
    expect(r.total).toBe(10)
  })

  it.each(DICE)('never rolls outside 1..%i', (die) => {
    for (let i = 0; i < 400; i++) {
      const { faces } = rollDice(die, 5)
      for (const f of faces) {
        expect(f).toBeGreaterThanOrEqual(1)
        expect(f).toBeLessThanOrEqual(die)
        expect(Number.isInteger(f)).toBe(true)
      }
    }
  })

  it('total always equals the sum of the faces', () => {
    for (let i = 0; i < 200; i++) {
      const r = rollDice(20, 4)
      expect(r.total).toBe(r.faces.reduce((a, b) => a + b, 0))
    }
  })

  it('clamps the count to something sane', () => {
    expect(rollDice(6, 0).faces).toHaveLength(1)
    expect(rollDice(6, -5).faces).toHaveLength(1)
    expect(rollDice(6, 999).faces).toHaveLength(MAX_ROLL_COUNT)
    expect(rollDice(6, 2.7).faces).toHaveLength(2)
    expect(rollDice(6, NaN).faces).toHaveLength(1)
  })

  // A d20 is the case where modulo bias would actually show up.
  it('is close to uniform on a d20', () => {
    const counts = new Array(21).fill(0)
    const n = 40000
    for (const f of rollDice(20, 1).faces) counts[f]++
    for (let i = 0; i < n / 20; i++) for (const f of rollDice(20, 20).faces) counts[f]++
    const expected = (n + 1) / 20
    for (let face = 1; face <= 20; face++) {
      expect(Math.abs(counts[face] - expected) / expected,
        `face ${face} appeared ${counts[face]} times, expected about ${Math.round(expected)}`).toBeLessThan(0.15)
    }
  })
})

describe('flipCoins', () => {
  it('reports heads and tails that add up', () => {
    for (let i = 0; i < 200; i++) {
      const r = flipCoins(7)
      expect(r.faces).toHaveLength(7)
      expect(r.heads + r.tails).toBe(7)
      expect(r.heads).toBe(r.faces.filter((f) => f === 'heads').length)
    }
  })

  it('maps the draw to a side deterministically', () => {
    expect(flipCoins(4, scripted([0, 1, 0, 1])).faces).toEqual(['heads', 'tails', 'heads', 'tails'])
  })

  it('is close to a fair coin', () => {
    const { heads, tails } = flipCoins(20, cryptoRandom)
    expect(heads + tails).toBe(20)
    let h = 0
    for (let i = 0; i < 2000; i++) h += flipCoins(10).heads
    expect(Math.abs(h - 10000) / 10000).toBeLessThan(0.06)
  })
})

describe('cryptoRandom', () => {
  it('stays within bounds', () => {
    for (const bound of [2, 6, 20, 100]) {
      for (let i = 0; i < 2000; i++) {
        const v = cryptoRandom(bound)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThan(bound)
      }
    }
  })
})
