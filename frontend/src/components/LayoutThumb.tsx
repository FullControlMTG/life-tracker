import type { LayoutNode, LayoutPreset } from '../game/layout'
import { ROTATION } from '../game/layout'

/**
 * A miniature of the real split tree, used on the orientation screen. It is the
 * same data the game renders, so what you pick is exactly what you get.
 *
 * The rectangles stay put; only the label inside each one rotates. Because the
 * glyph is a downward triangle in the seat's own frame, rotating it always
 * leaves it pointing at the edge that player sits at, and the seat number turns
 * with it to show which way their numbers will read.
 */
export function LayoutThumb({ preset }: { preset: LayoutPreset }) {
  const counter = { next: 0 }
  return <div className="thumb">{walk(preset.root, counter, 't')}</div>
}

function walk(node: LayoutNode, counter: { next: number }, key: string) {
  if (node.kind === 'seat') {
    const n = ++counter.next
    return (
      <div key={key} className="thumb-seat">
        <span className="thumb-label" style={{ transform: `rotate(${ROTATION[node.facing]}deg)` }}>
          <span className="thumb-num">{n}</span>
          <span className="thumb-arrow" aria-hidden="true">▼</span>
        </span>
      </div>
    )
  }
  return (
    <div key={key} className="thumb-split" style={{ flexDirection: node.dir }}>
      {node.children.map((child, i) => (
        <div key={i} className="thumb-cell" style={{ flexGrow: node.weights?.[i] ?? 1 }}>
          {walk(child, counter, `${key}.${i}`)}
        </div>
      ))}
    </div>
  )
}
