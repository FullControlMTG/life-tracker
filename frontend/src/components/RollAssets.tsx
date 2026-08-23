import { D20_FACETS, D20_SILHOUETTE, D20_TOP_FACE } from '../game/d20'
import type { CoinFace } from '../game/random'

/**
 * A d20 seen from above with its rolled value on the top face.
 *
 * The number lives on the face rather than beside the die, so a handful of dice
 * reads the way real dice on a table do - you scan the faces, not a list.
 */
export function DieFace({ value, label }: { value: number; label?: string }) {
  // The top face is an equilateral triangle, so its usable width is about
  // 1.15x its radius. Digits are sized to sit inside that, not spill over it.
  const digits = String(value).length
  const size = digits >= 3 ? 21 : digits === 2 ? 27 : 32

  return (
    <svg className="die-face" viewBox="0 0 100 100" role="img" aria-label={label ?? `rolled ${value}`}>
      <polygon points={D20_SILHOUETTE} className="die-edge" />
      {D20_FACETS.map((f, i) => (
        <polygon key={i} points={f.points} fill="currentColor" opacity={f.opacity} />
      ))}
      <polygon points={D20_TOP_FACE} fill="currentColor" opacity="0.62" />
      <text x="50" y="50" className="die-value" fontSize={size} dominantBaseline="central" textAnchor="middle">
        {value}
      </text>
    </svg>
  )
}

/**
 * A coin, milled edge and all. Heads and tails differ by tint and mark rather
 * than by a letter alone, so the result is legible across a table at a glance.
 */
export function CoinFace({ side }: { side: CoinFace }) {
  const heads = side === 'heads'
  return (
    <svg
      className={`coin-face${heads ? ' is-heads' : ' is-tails'}`}
      viewBox="0 0 100 100"
      role="img"
      aria-label={heads ? 'heads' : 'tails'}
    >
      <circle cx="50" cy="50" r="46" className="coin-rim" />
      {/* Milling: short ticks around the edge, the thing that reads as "coin". */}
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2
        return (
          <line
            key={i}
            x1={50 + 41 * Math.cos(a)}
            y1={50 + 41 * Math.sin(a)}
            x2={50 + 46 * Math.cos(a)}
            y2={50 + 46 * Math.sin(a)}
            className="coin-mill"
          />
        )
      })}
      <circle cx="50" cy="50" r="35" className="coin-field" />
      {heads ? (
        // A crowned profile, abstracted to two shapes.
        <g className="coin-mark">
          <path d="M34 62a16 16 0 0 1 32 0z" />
          <circle cx="50" cy="41" r="11" />
          <path d="M39 27l4 5 7-7 7 7 4-5-3 8H42z" />
        </g>
      ) : (
        <g className="coin-mark">
          <path d="M50 26l6.5 13.5L71 41.5l-10.5 10 2.5 14.5L50 59.2 37 66l2.5-14.5L29 41.5l14.5-2z" />
        </g>
      )}
    </svg>
  )
}
