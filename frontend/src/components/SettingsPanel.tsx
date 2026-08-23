import { useEffect } from 'react'
import { createPortal } from 'react-dom'

import { FONT_CHOICES, FONT_SCALES } from '../game/display'
import { useStore } from '../state/store'

/**
 * Display settings for this device. They are deliberately not tied to an
 * account: the tracker works signed out, and how big the numbers are is a
 * property of the screen on the table, not of who owns it.
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
        </div>
      </div>
    </div>,
    document.body,
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
