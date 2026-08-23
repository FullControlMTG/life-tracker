import { useEffect, useRef, useState } from 'react'

import { api } from '../api/client'
import type { Card, CardBackground } from '../api/types'

/**
 * Scryfall art picker. Results are art crops (illustration only, no card frame
 * or text box), which is what actually works as a player background.
 */
export function CardSearch({
  current,
  onPick,
  onClear,
  onFocusChange,
}: {
  current: CardBackground | null
  onPick: (card: CardBackground) => void
  onClear: () => void
  onFocusChange: (focusX: number, focusY: number) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Card[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'empty'>('idle')
  const requestId = useRef(0)

  const q = query.trim()
  const active = q.length >= 2

  useEffect(() => {
    if (!active) return

    const id = ++requestId.current
    const timer = setTimeout(async () => {
      setStatus('loading')
      try {
        const { cards } = await api.searchCards(q)
        // Ignore responses that a newer keystroke has already superseded.
        if (id !== requestId.current) return
        setResults(cards.slice(0, 24))
        setStatus(cards.length ? 'idle' : 'empty')
      } catch {
        if (id !== requestId.current) return
        setResults([])
        setStatus('error')
      }
    }, 280)

    return () => clearTimeout(timer)
  }, [q, active])

  // Derived rather than reset in an effect, so backspacing below two characters
  // clears the list without kicking off another render pass.
  const visible = active ? results : []
  const shown = active ? status : 'idle'

  return (
    <div className="cardsearch">
      <input
        className="field"
        placeholder="Search a card for artwork…"
        value={query}
        spellCheck={false}
        onChange={(e) => setQuery(e.target.value)}
      />

      {shown === 'loading' && <p className="muted">Searching…</p>}
      {shown === 'empty' && <p className="muted">No cards matched that.</p>}
      {shown === 'error' && <p className="muted">Card search is unavailable right now.</p>}

      {visible.length > 0 && (
        <div className="card-grid">
          {visible.map((card) => (
            <button
              key={card.scryfallId}
              className={`card-tile${current?.scryfallId === card.scryfallId ? ' is-active' : ''}`}
              title={`${card.name} — ${card.setName}`}
              onClick={() =>
                onPick({
                  scryfallId: card.scryfallId,
                  name: card.name,
                  imageUri: card.artCropUri,
                  focusX: 0.5,
                  focusY: 0.5,
                })
              }
            >
              <img src={card.artCropUri} alt={card.name} loading="lazy" />
              <span>{card.name}</span>
            </button>
          ))}
        </div>
      )}

      {current && (
        <div className="card-current">
          <p className="muted">
            Art: <strong>{current.name || 'custom'}</strong>
          </p>
          {/* The art is cropped, never squashed - these nudge which part survives the crop. */}
          <label className="mini-slider">
            <span>Crop across</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(current.focusX * 100)}
              onChange={(e) => onFocusChange(Number(e.target.value) / 100, current.focusY)}
            />
          </label>
          <label className="mini-slider">
            <span>Crop down</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(current.focusY * 100)}
              onChange={(e) => onFocusChange(current.focusX, Number(e.target.value) / 100)}
            />
          </label>
          <button className="btn subtle" onClick={onClear}>
            Remove artwork
          </button>
        </div>
      )}
    </div>
  )
}
