import { useEffect } from 'react'
import { createPortal } from 'react-dom'

import { useStore } from '../state/store'
import type { SeatState } from '../state/store'
import { ROTATION } from '../game/layout'
import { Icon } from './Icon'

/**
 * The picker behind a seat's name: the same list of saved players the seat menu
 * offers, one tap away instead of two.
 *
 * Like the seat menu it portals out of the seat rectangle - a seat can be a
 * short band with no room - while keeping the seat's rotation, so it faces the
 * player it belongs to. Sizing in vmin keeps it on screen after a quarter turn.
 */
export function SeatNameMenu({
  seat,
  onClose,
  onOpenSettings,
}: {
  seat: SeatState
  onClose: () => void
  onOpenSettings: () => void
}) {
  const { auth, remote, applyProfile } = useStore()
  const profiles = remote?.profiles ?? []
  const authed = auth.status === 'authed'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const pick = (id: string | null) => {
    applyProfile(seat.id, id)
    onClose()
  }

  return createPortal(
    <div className="sheet-scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="seat-menu"
        role="dialog"
        aria-modal="true"
        aria-label={`Choose who is in ${seat.name}'s seat`}
        style={{ transform: `rotate(${ROTATION[seat.facing]}deg)` }}
      >
        <header className="seat-menu-head">
          <Icon name={seat.symbol} size={16} />
          <strong>{seat.name}</strong>
        </header>

        <ul className="seat-menu-list" role="listbox" aria-label="Saved players">
          {authed && profiles.length > 0 ? (
            <>
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={seat.profileId === null}
                  className={`select-option${seat.profileId === null ? ' is-active' : ''}`}
                  onClick={() => pick(null)}
                >
                  — none —
                </button>
              </li>
              {profiles.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={p.id === seat.profileId}
                    className={`select-option${p.id === seat.profileId ? ' is-active' : ''}`}
                    onClick={() => pick(p.id)}
                  >
                    <span className="profile-dot" style={{ background: p.color }} />
                    {p.displayName}
                  </button>
                </li>
              ))}
            </>
          ) : (
            <li>
              <p className="muted">
                {authed
                  ? 'No saved players yet.'
                  : 'Sign in to save players and load them into a seat.'}
              </p>
            </li>
          )}
        </ul>

        <footer className="seat-menu-foot">
          <button className="btn subtle wide" onClick={onOpenSettings}>
            Seat settings…
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
