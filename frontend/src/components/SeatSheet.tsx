import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { useStore } from '../state/store'
import type { SeatState } from '../state/store'
import { GENERIC_COUNTERS } from '../game/icons'
import { Icon } from './Icon'
import { ROTATION } from '../game/layout'
import { ColorPicker } from './ColorPicker'
import { CardSearch } from './CardSearch'

const DEFAULT_SWATCHES = [
  '#1c77e0', '#e5294f', '#118a44', '#a44be9',
  '#a26e14', '#128495', '#506ee9', '#ce5019',
]

type Tab = 'player' | 'colour' | 'art' | 'counters'

/**
 * The per-seat menu.
 *
 * It escapes the seat rectangle via a portal - a seat can be a short band with
 * no room for a form - but keeps the seat's rotation, so a player sitting at the
 * left edge still reads it the right way up without anyone turning the device
 * around. Sizing in vmin means the rotated panel fits either way round.
 */
export function SeatSheet({ seat, onClose }: { seat: SeatState; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('player')
  const store = useStore()
  const authed = store.auth.status === 'authed'
  const profiles = store.remote?.profiles ?? []
  const attached = profiles.find((p) => p.id === seat.profileId) ?? null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="sheet-scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`${seat.name} settings`}
        style={{ transform: `rotate(${ROTATION[seat.facing]}deg)` }}
      >
      <header className="sheet-head">
        <strong>{seat.name}</strong>
        <button className="btn icon" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </header>

      <nav className="tabs">
        {(['player', 'colour', 'art', 'counters'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`tab${tab === t ? ' is-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'colour' ? 'Colour' : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      <div className="sheet-body">
        {tab === 'player' && <PlayerTab seat={seat} />}
        {tab === 'colour' && <ColourTab seat={seat} />}
        {tab === 'art' && <ArtTab seat={seat} />}
        {tab === 'counters' && <CountersTab seat={seat} />}
      </div>

      {!authed && (tab === 'player' || tab === 'art') && (
        <p className="sheet-foot muted">Sign in to save players and their colours.</p>
      )}
      {authed && attached && <p className="sheet-foot muted">Saved to “{attached.displayName}”.</p>}
      </div>
    </div>,
    document.body,
  )
}

function PlayerTab({ seat }: { seat: SeatState }) {
  const { auth, remote, applyProfile, setSeatName, createProfileFromSeat, adjustLife } = useStore()
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const profiles = remote?.profiles ?? []

  const saveProfile = async () => {
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    setError('')
    try {
      await createProfileFromSeat(seat.id, name)
      setNewName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that player.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {auth.status === 'authed' && (
        <label className="field-row">
          <span>Load a player</span>
          <select
            className="field"
            value={seat.profileId ?? ''}
            onChange={(e) => applyProfile(seat.id, e.target.value || null)}
          >
            <option value="">— none —</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="field-row">
        <span>Name on this seat</span>
        <input
          className="field"
          value={seat.name}
          maxLength={40}
          onChange={(e) => setSeatName(seat.id, e.target.value)}
        />
      </label>

      {auth.status === 'authed' && !seat.profileId && (
        <div className="field-row">
          <span>Save this seat as a player</span>
          <div className="inline">
            <input
              className="field"
              placeholder="Their name"
              value={newName}
              maxLength={40}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button className="btn" disabled={busy || !newName.trim()} onClick={saveProfile}>
              Save
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </div>
      )}

      <div className="field-row">
        <span>Life</span>
        <div className="inline">
          <button className="btn subtle" onClick={() => adjustLife(seat.id, -5)}>−5</button>
          <button className="btn subtle" onClick={() => adjustLife(seat.id, +5)}>+5</button>
          <button className="btn subtle" onClick={() => adjustLife(seat.id, -10)}>−10</button>
          <button className="btn subtle" onClick={() => adjustLife(seat.id, +10)}>+10</button>
        </div>
      </div>
    </>
  )
}

function ColourTab({ seat }: { seat: SeatState }) {
  const { remote, setSeatColor, rememberColor, updateProfile } = useStore()
  const attached = remote?.profiles.find((p) => p.id === seat.profileId) ?? null
  const swatches = attached?.savedColors.length ? attached.savedColors : DEFAULT_SWATCHES

  // Committing writes straight through: the colour lands on the profile and in
  // its 8-slot swatch history in one round trip each, no batching.
  const commit = (hex: string) => {
    if (!attached) return
    void updateProfile(attached.id, { color: hex, background: 'color' }).catch(() => {})
    void rememberColor(attached.id, hex).catch(() => {})
  }

  return (
    <>
      <ColorPicker
        value={seat.color}
        swatches={swatches}
        onChange={(hex) => setSeatColor(seat.id, hex)}
        onCommit={commit}
      />
      {attached && (
        <p className="muted">
          {attached.savedColors.length}/8 colours saved for {attached.displayName}.
        </p>
      )}
    </>
  )
}

function ArtTab({ seat }: { seat: SeatState }) {
  const { remote, setSeatCard, updateProfile } = useStore()
  const attached = remote?.profiles.find((p) => p.id === seat.profileId) ?? null

  return (
    <CardSearch
      current={seat.card}
      onPick={(card) => {
        setSeatCard(seat.id, card)
        if (attached) void updateProfile(attached.id, { background: 'image', card }).catch(() => {})
      }}
      onClear={() => {
        setSeatCard(seat.id, null)
        if (attached) void updateProfile(attached.id, { background: 'color', clearCard: true }).catch(() => {})
      }}
      onFocusChange={(focusX, focusY) => {
        if (!seat.card) return
        const card = { ...seat.card, focusX, focusY }
        setSeatCard(seat.id, card)
        if (attached) void updateProfile(attached.id, { background: 'image', card }).catch(() => {})
      }}
    />
  )
}

function CountersTab({ seat }: { seat: SeatState }) {
  const { seats, addCounter, removeCounter } = useStore()
  const opponents = seats.filter((s) => s.id !== seat.id)
  const tracked = new Set(seat.counters.map((c) => c.sourceSeatId).filter(Boolean))

  return (
    <>
      {opponents.length > 0 && (
        <div className="field-row">
          <span>Commander damage from</span>
          <div className="chip-row">
            {opponents.map((opp) => (
              <button
                key={opp.id}
                className="chip"
                style={{ borderColor: opp.color }}
                disabled={tracked.has(opp.id)}
                onClick={() =>
                  addCounter(seat.id, {
                    kind: 'commander',
                    icon: opp.symbol,
                    label: opp.name,
                    color: opp.color,
                    sourceSeatId: opp.id,
                  })
                }
              >
                <Icon name={opp.symbol} size={16} />
                {opp.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="field-row">
        <span>Other counters</span>
        <div className="chip-row">
          {GENERIC_COUNTERS.map((c) => (
            <button
              key={c.icon}
              className="chip"
              onClick={() => addCounter(seat.id, { kind: 'generic', icon: c.icon, label: c.label })}
            >
              <Icon name={c.icon} size={16} />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {seat.counters.length > 0 && (
        <div className="field-row">
          <span>On this seat</span>
          <div className="chip-row">
            {seat.counters.map((c) => (
              <button key={c.id} className="chip" onClick={() => removeCounter(seat.id, c.id)}>
                <Icon name={c.icon} size={16} />
                {c.label} · {c.value} ✕
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
