import { useEffect, useState } from 'react'

import { useStore } from '../state/store'
import { DICE, MAX_ROLL_COUNT, flipCoins, rollDice } from '../game/random'
import type { Die, FlipResult, RollResult } from '../game/random'
import { CoinFace, DieFace } from './RollAssets'

type Outcome =
  | { kind: 'roll'; result: RollResult }
  | { kind: 'flip'; result: FlipResult }
  | null

/**
 * The button in the middle of the table, where every player can reach it.
 *
 * It sits at the point the seats meet, so it belongs to nobody and is not
 * rotated - anyone leaning in can use it. Controls are deliberately oversized:
 * this is thumbed mid-game, often without looking.
 */
export function TableMenu() {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(1)
  const [outcome, setOutcome] = useState<Outcome>(null)
  const { restartGame, newGame } = useStore()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const close = () => {
    setOpen(false)
    setOutcome(null)
  }

  return (
    <>
      <button
        className="table-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Table actions"
        onClick={() => setOpen(true)}
      >
        <Heptagon />
      </button>

      {open && (
        <div className="sheet-scrim" onPointerDown={(e) => e.target === e.currentTarget && close()}>
          <div className="table-panel" role="dialog" aria-modal="true" aria-label="Table actions">
            <header className="table-panel-head">
              <strong>Table</strong>
              <button className="fade-btn" aria-label="Close" onClick={close}>
                ✕
              </button>
            </header>

            <div className="table-panel-body">
              {outcome && <Outcome outcome={outcome} />}

              <p className="table-label">How many</p>
              <div className="count-row">
                {[1, 2, 3, 4, 6].map((n) => (
                  <button
                    key={n}
                    className={`big-btn count${count === n ? ' is-active' : ''}`}
                    onClick={() => setCount(n)}
                  >
                    {n}
                  </button>
                ))}
                <button
                  className="big-btn count"
                  aria-label="More"
                  onClick={() => setCount((c) => Math.min(MAX_ROLL_COUNT, c + 1))}
                >
                  +
                </button>
              </div>

              <p className="table-label">Roll</p>
              <div className="dice-row">
                {DICE.map((d: Die) => (
                  <button
                    key={d}
                    className="big-btn die"
                    onClick={() => setOutcome({ kind: 'roll', result: rollDice(d, count) })}
                  >
                    d{d}
                  </button>
                ))}
              </div>

              <p className="table-label">Flip</p>
              <button
                className="big-btn wide"
                onClick={() => setOutcome({ kind: 'flip', result: flipCoins(count) })}
              >
                {count === 1 ? 'Flip a coin' : `Flip ${count} coins`}
              </button>

              <p className="table-label">Game</p>
              <button className="big-btn wide" onClick={() => { restartGame(); close() }}>
                Reset life totals
              </button>
              <button className="big-btn wide" onClick={() => { newGame(); close() }}>
                New game
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Outcome({ outcome }: { outcome: NonNullable<Outcome> }) {
  if (outcome.kind === 'roll') {
    const { die, faces, total } = outcome.result
    return (
      <div className="outcome" role="status" aria-live="polite">
        <div className="outcome-faces">
          {faces.map((f, i) => (
            <DieFace key={i} value={f} label={`die ${i + 1} rolled ${f}`} />
          ))}
        </div>
        {faces.length > 1 && (
          <div className="outcome-side">
            <span className="outcome-total">{total}</span>
            <span className="outcome-detail">
              {faces.length}d{die}
            </span>
          </div>
        )}
        {faces.length === 1 && <span className="outcome-detail">d{die}</span>}
      </div>
    )
  }

  const { faces, heads, tails } = outcome.result
  return (
    <div className="outcome" role="status" aria-live="polite">
      <div className="outcome-faces">
        {faces.map((f, i) => (
          <CoinFace key={i} side={f} />
        ))}
      </div>
      {faces.length > 1 ? (
        <div className="outcome-side">
          <span className="outcome-total">
            {heads}–{tails}
          </span>
          <span className="outcome-detail">
            {heads} heads, {tails} tails
          </span>
        </div>
      ) : (
        <span className="outcome-detail">{heads ? 'Heads' : 'Tails'}</span>
      )}
    </div>
  )
}

/** Seven sides: not a die, not a button anyone mistakes for a player control. */
function Heptagon() {
  const points = Array.from({ length: 7 }, (_, i) => {
    const angle = (i / 7) * Math.PI * 2 - Math.PI / 2
    return `${(12 + 10 * Math.cos(angle)).toFixed(2)},${(12 + 10 * Math.sin(angle)).toFixed(2)}`
  }).join(' ')
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <polygon points={points} fill="currentColor" opacity="0.9" />
    </svg>
  )
}
