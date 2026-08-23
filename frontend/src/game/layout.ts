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


/** Normalised 0-1 rectangle on screen. */
export interface Rect {
  x0: number
  y0: number
  x1: number
  y1: number
}

export type ScreenEdge = 'top' | 'right' | 'bottom' | 'left'

const EPSILON = 1e-6

/**
 * Where each seat lands on screen, walking the tree the way flexbox does.
 * Seats come back in the same depth-first order as facingOrder.
 */
export function seatRects(node: LayoutNode, box: Rect = { x0: 0, y0: 0, x1: 1, y1: 1 }): Rect[] {
  if (node.kind === 'seat') return [box]

  const weights = node.children.map((_, i) => node.weights?.[i] ?? 1)
  const total = weights.reduce((a, b) => a + b, 0)
  const out: Rect[] = []

  let offset = 0
  node.children.forEach((child, i) => {
    const share = weights[i] / total
    const next =
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
    out.push(...seatRects(child, next))
    offset += share
  })
  return out
}

/** Which outer edges of the screen a seat is flush against. */
export function screenEdges(rect: Rect): ScreenEdge[] {
  const edges: ScreenEdge[] = []
  if (rect.y0 <= EPSILON) edges.push('top')
  if (rect.x1 >= 1 - EPSILON) edges.push('right')
  if (rect.y1 >= 1 - EPSILON) edges.push('bottom')
  if (rect.x0 <= EPSILON) edges.push('left')
  return edges
}

const SIDES: ScreenEdge[] = ['top', 'right', 'bottom', 'left']

/**
 * Which side of a seat's own rotated frame is pointing at a given screen edge.
 *
 * A seat's controls live along its local edges, but system gestures live along
 * the screen's. Rotating by 90 degrees clockwise sends local "left" to the top
 * of the screen, so a guard meant for the screen top has to be applied to the
 * local left.
 */
export function localSideFacing(screenEdge: ScreenEdge, rotation: number): ScreenEdge {
  const steps = (((rotation / 90) % 4) + 4) % 4
  const index = SIDES.indexOf(screenEdge)
  return SIDES[(index - steps + 4) % 4]
}

/**
 * Local sides of a seat that sit against a screen edge, and so should hold their
 * controls clear of it. iPadOS reserves the screen edges for Control Centre and
 * Notification Centre; a tap that starts there can be swallowed by the system.
 */
export function edgeGuardSides(rect: Rect, facing: Facing): ScreenEdge[] {
  return screenEdges(rect).map((edge) => localSideFacing(edge, ROTATION[facing]))
}
