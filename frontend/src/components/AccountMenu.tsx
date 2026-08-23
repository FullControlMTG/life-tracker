import { useEffect, useRef, useState } from 'react'

import { ApiError } from '../api/types'
import { useStore } from '../state/store'
import { SettingsPanel } from './SettingsPanel'
import { useFullscreen } from './useFullscreen'

/**
 * The only chrome that sits over the game: one small button in the top-right
 * that opens account and game controls. Everything else is background.
 */
export function AccountMenu() {
  const [open, setOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const { auth, logout } = useStore()
  const fullscreen = useFullscreen()

  return (
    <div className="account" ref={wrap}>
      <button
        className="account-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu"
        onClick={() => setOpen((v) => !v)}
      >
        {auth.status === 'authed' ? initials(auth.user?.displayName ?? '?') : '☰'}
      </button>

      {/* Fullscreen can be dropped by Escape, a reload, or the iPadOS keyboard -
          none of which the page can veto - so offer it back in one tap. */}
      {fullscreen.supported && fullscreen.wanted && !fullscreen.active && (
        <button className="restore-fullscreen" onClick={fullscreen.restore}>
          <Expand />
          Fullscreen
        </button>
      )}

      {open && (
        <div className="account-panel" role="menu">
          <div className="panel-group">
            <button
              className="btn subtle wide"
              onClick={() => {
                setSettingsOpen(true)
                setOpen(false)
              }}
            >
              Settings
            </button>
          </div>

          {/* Not offered on iPhone Safari, which has no fullscreen API. */}
          {fullscreen.supported && (
            <div className="panel-group">
              <button
                className="btn subtle wide"
                onClick={() => {
                  fullscreen.toggle()
                  setOpen(false)
                }}
              >
                {fullscreen.active ? 'Exit fullscreen' : 'Enter fullscreen'}
              </button>
            </div>
          )}

          {auth.status === 'authed' ? (
            <div className="panel-group">
              <p className="muted">
                Signed in as <strong>{auth.user?.displayName}</strong>
              </p>
              <ProfileManager />
              <button className="btn subtle wide" onClick={() => { void logout(); setOpen(false) }}>
                Sign out
              </button>
            </div>
          ) : (
            <AuthForm />
          )}
        </div>
      )}

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

function Expand() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor">
      <path d="M4 4h7v2H6v5H4V4zm9 0h7v7h-2V6h-5V4zM4 13h2v5h5v2H4v-7zm14 0h2v7h-7v-2h5v-5z" />
    </svg>
  )
}

function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || '?'
}

function AuthForm() {
  const { login, register } = useStore()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setFields({})
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password, displayName)
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields)
        setError(Object.keys(err.fields).length ? '' : err.message)
      } else {
        setError('Something went wrong.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="panel-group" onSubmit={submit}>
      <p className="muted">
        {mode === 'login'
          ? 'Sign in to save players, colours and artwork.'
          : 'Create an account to save players across devices.'}
      </p>

      {mode === 'register' && (
        <>
          <input
            className="field"
            placeholder="Your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          {fields.displayName && <p className="error">{fields.displayName}</p>}
        </>
      )}

      <input
        className="field"
        type="email"
        autoComplete="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {fields.email && <p className="error">{fields.email}</p>}

      <input
        className="field"
        type="password"
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {fields.password && <p className="error">{fields.password}</p>}
      {error && <p className="error">{error}</p>}

      <button className="btn wide" type="submit" disabled={busy}>
        {mode === 'login' ? 'Sign in' : 'Create account'}
      </button>
      <button
        className="btn link"
        type="button"
        onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setFields({}); setError('') }}
      >
        {mode === 'login' ? 'Need an account?' : 'Already have an account?'}
      </button>
    </form>
  )
}

function ProfileManager() {
  const { remote, deleteProfile } = useStore()
  const profiles = remote?.profiles ?? []
  if (profiles.length === 0) {
    return <p className="muted">No saved players yet. Save one from a seat’s ⋯ menu.</p>
  }
  return (
    <div className="profile-list">
      {profiles.map((p) => (
        <div key={p.id} className="profile-row">
          <span className="profile-dot" style={{ background: p.color }} />
          <span className="profile-name">{p.displayName}</span>
          <span className="profile-swatches">
            {p.savedColors.slice(0, 8).map((c) => (
              <i key={c} style={{ background: c }} />
            ))}
          </span>
          <button
            className="btn icon ghost"
            aria-label={`Delete ${p.displayName}`}
            onClick={() => void deleteProfile(p.id).catch(() => {})}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
