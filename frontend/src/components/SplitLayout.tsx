import { Fragment } from 'react'
import type { ReactNode } from 'react'

import { edgeGuardSides, seatRects } from '../game/layout'
import type { Facing, LayoutNode, ScreenEdge } from '../game/layout'

/**
 * Renders a layout tree as nested flex boxes. Seats are handed to `renderSeat`
 * in depth-first order, which is the order they read on screen.
 */
export function SplitLayout({
  root,
  renderSeat,
}: {
  root: LayoutNode
  renderSeat: (index: number, facing: Facing, guards: ScreenEdge[]) => ReactNode
}) {
  const counter = { next: 0 }
  // Which of each seat's own sides lie against a screen edge, so its controls
  // can be held clear of the system's gesture areas.
  const rects = seatRects(root)
  const guardsFor = (index: number, facing: Facing) =>
    rects[index] ? edgeGuardSides(rects[index], facing) : []
  return <div className="split-root">{walk(root, counter, renderSeat, guardsFor, 'r')}</div>
}

function walk(
  node: LayoutNode,
  counter: { next: number },
  renderSeat: (index: number, facing: Facing, guards: ScreenEdge[]) => ReactNode,
  guardsFor: (index: number, facing: Facing) => ScreenEdge[],
  key: string,
): ReactNode {
  if (node.kind === 'seat') {
    const index = counter.next++
    return <Fragment key={key}>{renderSeat(index, node.facing, guardsFor(index, node.facing))}</Fragment>
  }
  return (
    <div key={key} className="split" style={{ flexDirection: node.dir }}>
      {node.children.map((child, i) => (
        <div key={i} className="split-cell" style={{ flexGrow: node.weights?.[i] ?? 1 }}>
          {walk(child, counter, renderSeat, guardsFor, `${key}.${i}`)}
        </div>
      ))}
    </div>
  )
}
