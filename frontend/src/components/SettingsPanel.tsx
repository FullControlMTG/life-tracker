import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { FONT_CHOICES, FONT_SCALES } from '../game/display'
import { useStore } from '../state/store'
import type { Profile } from '../api/types'

/**
 * Display settings for this device. They are deliberately not tied to an
 * account: the tracker works signed out, and how big the numbers are is a
 * property of the screen on the table, not of who owns it.
 *
 * Saved players are the one account-scoped thing here, and only because they
 * need the room: the list is unbounded, so it gets a scroll box and a filter
 * instead of a dropdown that grows without limit.
 */
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { display, setDisplay } = useStore()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="sheet-scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="table-panel" role="dialog" aria-modal="true" aria-label="Settings">
        <header className="table-panel-head">
          <strong>Settings</strong>
          <button className="fade-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="table-panel-body">
          <p className="table-label">Font</p>
          <div className="settings-row">
            {FONT_CHOICES.map((f) => (
              <button
                key={f.value}
                className={`big-btn${display.font === f.value ? ' is-active' : ''}`}
                style={{ fontFamily: f.stack }}
                aria-pressed={display.font === f.value}
                onClick={() => setDisplay({ font: f.value })}
              >
                {f.label}
              </button>
            ))}
          </div>

          <p className="table-label">Text size</p>
          <div className="settings-row">
            {FONT_SCALES.map((s) => (
              <button
                key={s.value}
                className={`big-btn${display.fontScale === s.value ? ' is-active' : ''}`}
                aria-pressed={display.fontScale === s.value}
                aria-label={`Text size ${s.label}`}
                onClick={() => setDisplay({ fontScale: s.value })}
              >
                {s.label}
              </button>
            ))}
          </div>

          <p className="table-label">Life buttons</p>
          <div className="settings-row two">
            <button
              className={`big-btn split-choice${display.tapSplit === 'vertical' ? ' is-active' : ''}`}
              aria-pressed={display.tapSplit === 'vertical'}
              onClick={() => setDisplay({ tapSplit: 'vertical' })}
            >
              <SplitPreview kind="vertical" />
              <span>Left / right</span>
            </button>
            <button
              className={`big-btn split-choice${display.tapSplit === 'horizontal' ? ' is-active' : ''}`}
              aria-pressed={display.tapSplit === 'horizontal'}
              onClick={() => setDisplay({ tapSplit: 'horizontal' })}
            >
              <SplitPreview kind="horizontal" />
              <span>Top / bottom</span>
            </button>
          </div>
          <p className="muted">Where each player taps to add or remove life.</p>

          <SavedPlayers />
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Past this many, scanning the list beats scrolling it. */
const FILTER_THRESHOLD = 6

/**
 * The account's saved players, collapsed by default. An account can accumulate
 * as many as it likes, so the list only costs its height once someone asks for
 * it, and above a handful it gains a filter.
 */
function SavedPlayers() {
  const { auth, remote } = useStore()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  if (auth.status !== 'authed') return null

  const profiles = remote?.profiles ?? []
  const needle = query.trim().toLowerCase()
  const shown = needle
    ? profiles.filter((p) => p.displayName.toLowerCase().includes(needle))
    : profiles

  return (
    <>
      <p className="table-label">Saved players</p>

      {profiles.length === 0 ? (
        <p className="muted">No saved players yet. Save one from a seat’s ⋯ menu.</p>
      ) : (
        <>
          <button
            className="disclosure"
            aria-expanded={open}
            aria-controls="saved-players"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="disclosure-caret" aria-hidden="true">
              ▸
            </span>
            <span className="disclosure-label">
              {profiles.length} saved {profiles.length === 1 ? 'player' : 'players'}
            </span>
          </button>

          {open && (
            <div id="saved-players" className="profile-drawer">
              {profiles.length > FILTER_THRESHOLD && (
                <input
                  className="field"
                  type="search"
                  placeholder="Filter players"
                  aria-label="Filter saved players"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              )}

              {shown.length === 0 ? (
                <p className="muted">No player matches “{query.trim()}”.</p>
              ) : (
                <div className="profile-list">
                  {shown.map((p) => (
                    <ProfileRow key={p.id} profile={p} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  )
}

/**
 * Deletion is confirmed inline rather than with confirm(): a browser modal can
 * drop the page out of fullscreen, and a stray tap here loses a player's colours
 * and artwork for good.
 */
function ProfileRow({ profile }: { profile: Profile }) {
  const deleteProfile = useStore((s) => s.deleteProfile)
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className="profile-row" role="alertdialog" aria-label={`Delete ${profile.displayName}?`}>
        <span className="profile-name">Delete {profile.displayName}?</span>
        <button className="btn subtle" onClick={() => setConfirming(false)}>
          Keep
        </button>
        <button
          className="btn subtle danger"
          onClick={() => void deleteProfile(profile.id).catch(() => {})}
        >
          Delete
        </button>
      </div>
    )
  }

  return (
    <div className="profile-row">
      <span className="profile-dot" style={{ background: profile.color }} />
      <span className="profile-name">{profile.displayName}</span>
      <span className="profile-swatches">
        {profile.savedColors.slice(0, 8).map((c) => (
          <i key={c} style={{ background: c }} />
        ))}
      </span>
      <button
        className="btn icon ghost"
        aria-label={`Delete ${profile.displayName}`}
        onClick={() => setConfirming(true)}
      >
        ✕
      </button>
    </div>
  )
}

/** Shows the cut and which half adds life, so the choice needs no explaining. */
function SplitPreview({ kind }: { kind: 'vertical' | 'horizontal' }) {
  const vertical = kind === 'vertical'
  return (
    <svg viewBox="0 0 60 36" className="split-preview" aria-hidden="true">
      <rect x="1" y="1" width="58" height="34" rx="5" className="split-preview-box" />
      {vertical ? (
        <line x1="30" y1="1" x2="30" y2="35" className="split-preview-cut" />
      ) : (
        <line x1="1" y1="18" x2="59" y2="18" className="split-preview-cut" />
      )}
      <text x={vertical ? 15 : 30} y={vertical ? 18 : 10} className="split-preview-mark">−</text>
      <text x={vertical ? 45 : 30} y={vertical ? 18 : 28} className="split-preview-mark">+</text>
    </svg>
  )
}
