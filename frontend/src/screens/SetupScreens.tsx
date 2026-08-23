import { useState } from 'react'

import { LayoutThumb } from '../components/LayoutThumb'
import { MAX_PLAYERS, MIN_PLAYERS, layoutsFor } from '../game/layout'
import { useStore } from '../state/store'

const LIFE_PRESETS = [
  { value: 40, label: 'Commander' },
  { value: 20, label: 'Constructed' },
  { value: 30, label: 'Brawl' },
  { value: 25, label: 'Two-headed' },
]

/** Step 1 — how many players. */
export function PlayersScreen() {
  const { config, setPlayerCount, goto } = useStore()
  const counts = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => i + MIN_PLAYERS)

  return (
    <Step title="How many players?" step={1}>
      <div className="choice-grid">
        {counts.map((n) => (
          <button
            key={n}
            className={`choice${config.playerCount === n ? ' is-active' : ''}`}
            onClick={() => setPlayerCount(n)}
          >
            <span className="choice-value">{n}</span>
            <span className="choice-label">{n === 1 ? 'player' : 'players'}</span>
          </button>
        ))}
      </div>
      <div className="step-actions">
        <button className="btn primary" onClick={() => goto('life')}>
          Continue
        </button>
      </div>
    </Step>
  )
}

/** Step 2 — starting life. */
export function LifeScreen() {
  const { config, setStartingLife, goto } = useStore()
  const [custom, setCustom] = useState(String(config.startingLife))

  return (
    <Step title="Starting life total" step={2}>
      <div className="choice-grid">
        {LIFE_PRESETS.map((p) => (
          <button
            key={p.value}
            className={`choice${config.startingLife === p.value ? ' is-active' : ''}`}
            onClick={() => {
              setStartingLife(p.value)
              setCustom(String(p.value))
            }}
          >
            <span className="choice-value">{p.value}</span>
            <span className="choice-label">{p.label}</span>
          </button>
        ))}
      </div>

      <label className="field-row centered">
        <span>Or set your own</span>
        <input
          className="field narrow"
          inputMode="numeric"
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value)
            const n = Number(e.target.value)
            if (Number.isFinite(n) && n > 0) setStartingLife(n)
          }}
        />
      </label>

      <div className="step-actions">
        <button className="btn subtle" onClick={() => goto('players')}>
          Back
        </button>
        <button className="btn primary" onClick={() => goto('layout')}>
          Continue
        </button>
      </div>
    </Step>
  )
}

/**
 * Step 3 — orientation. Each thumbnail is the actual split tree rendered small,
 * with an arrow per seat showing which edge that player reads from.
 */
export function LayoutScreen() {
  const { config, goto, startGame } = useStore()
  const presets = layoutsFor(config.playerCount)
  const [picked, setPicked] = useState(config.layoutId || presets[0]?.id || '')

  return (
    <Step title="How is everyone sat?" step={3}>
      <div className="layout-grid">
        {presets.map((preset) => (
          <button
            key={preset.id}
            className={`layout-option${picked === preset.id ? ' is-active' : ''}`}
            onClick={() => setPicked(preset.id)}
          >
            <LayoutThumb preset={preset} />
            <span className="layout-name">{preset.name}</span>
            <span className="layout-hint">{preset.hint}</span>
          </button>
        ))}
      </div>

      <div className="step-actions">
        <button className="btn subtle" onClick={() => goto('life')}>
          Back
        </button>
        <button className="btn primary" disabled={!picked} onClick={() => startGame(picked)}>
          Start game
        </button>
      </div>
    </Step>
  )
}

function Step({ title, step, children }: { title: string; step: number; children: React.ReactNode }) {
  return (
    <div className="step">
      <div className="step-inner">
        <p className="step-eyebrow">Step {step} of 3</p>
        <h1 className="step-title">{title}</h1>
        {children}
      </div>
    </div>
  )
}
