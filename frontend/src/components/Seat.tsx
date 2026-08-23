import { useState } from 'react'

import { useStore } from '../state/store'
import type { Counter, SeatState } from '../state/store'
import { readableInk, seatGradient } from '../game/color'
import { Icon } from './Icon'
import { ROTATION } from '../game/layout'
import { SeatSheet } from './SeatSheet'
import { useHold } from './useHold'

/**
 * One player's area.
 *
 * The outer element is the real rectangle from the split tree and stays
 * unrotated, so a card background can fill it with object-fit: cover - cropped
 * on whichever axis overflows, never stretched. Everything readable lives in
 * `.seat-rotor`, which is rotated to face that player's edge. Container query
 * units (100cqh/100cqw) give the rotated frame its swapped dimensions without
 * measuring anything in JS.
 */
export function Seat({ seat }: { seat: SeatState }) {
  const adjustLife = useStore((s) => s.adjustLife)
  const [sheetOpen, setSheetOpen] = useState(false)

  const minus = useHold(() => adjustLife(seat.id, -1))
  const plus = useHold(() => adjustLife(seat.id, +1))

  const ink = seat.background === 'image' ? '#f8fafc' : readableInk(seat.color)
  const rotation = ROTATION[seat.facing]

  return (
    <section
      className="seat"
      data-rot={rotation}
      data-bg={seat.background}
      style={{
        background: seatGradient(seat.color),
        color: ink,
        ['--ink' as string]: ink,
      }}
      aria-label={`${seat.name}, ${seat.life} life`}
    >
      {seat.background === 'image' && seat.card && (
        <img
          className="seat-art"
          src={seat.card.imageUri}
          alt=""
          style={{ objectPosition: `${seat.card.focusX * 100}% ${seat.card.focusY * 100}%` }}
        />
      )}
      {seat.background === 'image' && <span className="seat-veil" />}

      <div className="seat-rotor">
        <button className="tap-zone minus" aria-label={`${seat.name} lose 1 life`} {...minus}>
          <span>−</span>
        </button>
        <button className="tap-zone plus" aria-label={`${seat.name} gain 1 life`} {...plus}>
          <span>+</span>
        </button>

        <div className="seat-face">
          <header className="seat-head">
            <span className="seat-name">
              <Icon name={seat.symbol} size={16} />
              {seat.name}
            </span>
            <button
              className="btn icon ghost"
              aria-label={`${seat.name} settings`}
              onClick={() => setSheetOpen(true)}
            >
              ⋯
            </button>
          </header>

          <div className="seat-life">
            <span className="life-value">{seat.life}</span>
            {seat.recentDelta !== 0 && (
              <span className="life-delta">
                {seat.recentDelta > 0 ? '+' : ''}
                {seat.recentDelta}
              </span>
            )}
          </div>

          {seat.counters.length > 0 && (
            <footer className="seat-counters">
              {seat.counters.map((c) => (
                <CounterChip key={c.id} seatId={seat.id} counter={c} />
              ))}
            </footer>
          )}
        </div>

        {sheetOpen && <SeatSheet seat={seat} onClose={() => setSheetOpen(false)} />}
      </div>
    </section>
  )
}

function CounterChip({ seatId, counter }: { seatId: string; counter: Counter }) {
  const adjustCounter = useStore((s) => s.adjustCounter)
  const down = useHold(() => adjustCounter(seatId, counter.id, -1))
  const up = useHold(() => adjustCounter(seatId, counter.id, +1))

  // Commander counters wear the attacking player's colour, so you can tell who
  // the damage came from without reading the label.
  const tint = counter.color ? { borderColor: counter.color } : undefined

  return (
    <div className="counter" style={tint} title={`${counter.label}: ${counter.value}`}>
      <button className="counter-step" aria-label={`${counter.label} down`} {...down}>
        −
      </button>
      <span className="counter-body">
        <Icon name={counter.icon} size={14} />
        <b>{counter.value}</b>
      </span>
      <button className="counter-step" aria-label={`${counter.label} up`} {...up}>
        +
      </button>
    </div>
  )
}
