/**
 * Dice and coins for the table.
 *
 * Randomness comes from crypto.getRandomValues, with rejection sampling so the
 * result is uniform: taking a raw 32-bit value modulo N skews toward the low
 * faces, which is exactly the bias you would notice on a d20.
 */

export type Die = 4 | 6 | 8 | 10 | 12 | 20 | 100

export const DICE: Die[] = [4, 6, 8, 10, 12, 20, 100]

export type RandomSource = (bound: number) => number

/** Uniform integer in [0, bound), rejecting the biased tail of the 32-bit range. */
export const cryptoRandom: RandomSource = (bound) => {
  const limit = Math.floor(0x100000000 / bound) * bound
  const buf = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buf)
    if (buf[0] < limit) return buf[0] % bound
  }
}

export interface RollResult {
  die: Die
  faces: number[]
  total: number
}

export function rollDice(die: Die, count: number, random: RandomSource = cryptoRandom): RollResult {
  const n = clampCount(count)
  const faces = Array.from({ length: n }, () => random(die) + 1)
  return { die, faces, total: faces.reduce((a, b) => a + b, 0) }
}

export type CoinFace = 'heads' | 'tails'

export interface FlipResult {
  faces: CoinFace[]
  heads: number
  tails: number
}

export function flipCoins(count: number, random: RandomSource = cryptoRandom): FlipResult {
  const n = clampCount(count)
  const faces: CoinFace[] = Array.from({ length: n }, () => (random(2) === 0 ? 'heads' : 'tails'))
  const heads = faces.filter((f) => f === 'heads').length
  return { faces, heads, tails: faces.length - heads }
}

export const MAX_ROLL_COUNT = 20

function clampCount(count: number): number {
  if (!Number.isFinite(count)) return 1
  return Math.max(1, Math.min(MAX_ROLL_COUNT, Math.floor(count)))
}
