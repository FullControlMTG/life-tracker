import { Fragment } from 'react'
import type { ReactNode } from 'react'

import type { Facing, LayoutNode } from '../game/layout'

/**
 * Renders a layout tree as nested flex boxes. Seats are handed to `renderSeat`
 * in depth-first order, which is the order they read on screen.
 */
export function SplitLayout({
  root,
  renderSeat,
}: {
  root: LayoutNode
  renderSeat: (index: number, facing: Facing) => ReactNode
}) {
  const counter = { next: 0 }
  return <div className="split-root">{walk(root, counter, renderSeat, 'r')}</div>
}

function walk(
  node: LayoutNode,
  counter: { next: number },
  renderSeat: (index: number, facing: Facing) => ReactNode,
  key: string,
): ReactNode {
  if (node.kind === 'seat') {
    const index = counter.next++
    return <Fragment key={key}>{renderSeat(index, node.facing)}</Fragment>
  }
  return (
    <div key={key} className="split" style={{ flexDirection: node.dir }}>
      {node.children.map((child, i) => (
        <div key={i} className="split-cell" style={{ flexGrow: node.weights?.[i] ?? 1 }}>
          {walk(child, counter, renderSeat, `${key}.${i}`)}
        </div>
      ))}
    </div>
  )
}
