/**
 * Screen splitting.
 *
 * A layout is a binary split tree. The rule that shapes every preset below:
 * every seat rectangle must touch an outer edge of the screen, because a seat
 * faces the edge its player sits at and an interior rectangle has no edge to
 * face. Only 90-degree cuts are used, so a tree of nested flex rows/columns
 * renders it exactly.
 */

/** The screen edge a player sits at; drives the seat's rotation. */
export type Facing = 'bottom' | 'top' | 'left' | 'right'

export type LayoutNode =
  | { kind: 'seat'; facing: Facing }
  | { kind: 'split'; dir: 'row' | 'column'; children: LayoutNode[]; weights?: number[] }

export interface LayoutPreset {
  id: string
  name: string
  /** Short note shown under the thumbnail on the orientation screen. */
  hint: string
  players: number
  root: LayoutNode
}

const seat = (facing: Facing): LayoutNode => ({ kind: 'seat', facing })

/** Left-to-right split (a vertical cut). */
const row = (children: LayoutNode[], weights?: number[]): LayoutNode => ({
  kind: 'split',
  dir: 'row',
  children,
  weights,
})

/** Top-to-bottom split (a horizontal cut). */
const column = (children: LayoutNode[], weights?: number[]): LayoutNode => ({
  kind: 'split',
  dir: 'column',
  children,
  weights,
})

export const ROTATION: Record<Facing, number> = {
  bottom: 0,
  top: 180,
  left: 90,
  right: 270,
}

export const LAYOUTS: LayoutPreset[] = [
  {
    id: '1p',
    name: 'Solo',
    hint: 'Whole screen',
    players: 1,
    root: seat('bottom'),
  },

  {
    id: '2p-duel',
    name: 'Across',
    hint: 'Facing each other',
    players: 2,
    root: column([seat('top'), seat('bottom')]),
  },
  {
    id: '2p-sides',
    name: 'Side by side',
    hint: 'Sat along the long edges',
    players: 2,
    root: row([seat('left'), seat('right')]),
  },

  {
    id: '3p-t',
    name: 'Three up',
    hint: 'One across, two beside',
    players: 3,
    root: column([seat('top'), row([seat('left'), seat('right')])]),
  },
  {
    id: '3p-wedge',
    name: 'Wedge',
    hint: 'One long edge, two stacked',
    players: 3,
    root: row([seat('left'), column([seat('top'), seat('bottom')])]),
  },

  {
    id: '4p-sides',
    name: 'Two and two',
    hint: 'Pairs on the long edges',
    players: 4,
    root: column([row([seat('left'), seat('right')]), row([seat('left'), seat('right')])]),
  },
  {
    id: '4p-edges',
    name: 'All four edges',
    hint: 'One player per edge',
    players: 4,
    root: column([seat('top'), row([seat('left'), seat('right')]), seat('bottom')], [1, 1.3, 1]),
  },

  {
    id: '5p-stack',
    name: 'Four and one',
    hint: 'Two pairs plus an end',
    players: 5,
    root: column([
      row([seat('left'), seat('right')]),
      row([seat('left'), seat('right')]),
      seat('bottom'),
    ], [1, 1, 0.8]),
  },
  {
    id: '5p-edges',
    name: 'Head of table',
    hint: 'One at the top, four beside',
    players: 5,
    root: column([
      seat('top'),
      row([seat('left'), seat('right')]),
      row([seat('left'), seat('right')]),
    ], [0.8, 1, 1]),
  },

  {
    id: '6p-columns',
    name: 'Three and three',
    hint: 'Two columns of three',
    players: 6,
    root: column([
      row([seat('left'), seat('right')]),
      row([seat('left'), seat('right')]),
      row([seat('left'), seat('right')]),
    ]),
  },
  {
    id: '6p-edges',
    name: 'Full table',
    hint: 'Both ends plus two a side',
    players: 6,
    root: column([
      seat('top'),
      row([column([seat('left'), seat('left')]), column([seat('right'), seat('right')])]),
      seat('bottom'),
    ], [0.7, 2, 0.7]),
  },
]

export const MIN_PLAYERS = 1
export const MAX_PLAYERS = 6

export function layoutsFor(players: number): LayoutPreset[] {
  return LAYOUTS.filter((l) => l.players === players)
}

export function layoutById(id: string): LayoutPreset | undefined {
  return LAYOUTS.find((l) => l.id === id)
}

/**
 * Seats are numbered depth-first, which is the order they read on screen:
 * top-to-bottom, then left-to-right within a row.
 */
export function facingOrder(node: LayoutNode, out: Facing[] = []): Facing[] {
  if (node.kind === 'seat') {
    out.push(node.facing)
    return out
  }
  for (const child of node.children) facingOrder(child, out)
  return out
}

export function seatCount(node: LayoutNode): number {
  return node.kind === 'seat' ? 1 : node.children.reduce((n, c) => n + seatCount(c), 0)
}
