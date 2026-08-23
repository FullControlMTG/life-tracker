import { useCallback, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

import { hexToHsl, hslToHex, isHex } from '../game/color'

/**
 * A pointer-driven slider. Rebuilt rather than using <input type="range">
 * because the track needs a live gradient fill and a touch target big enough to
 * drag with a thumb on a phone.
 */
function Slider({
  value,
  min,
  max,
  gradient,
  label,
  onChange,
}: {
  value: number
  min: number
  max: number
  gradient: string
  label: string
  onChange: (v: number) => void
}) {
  const track = useRef<HTMLDivElement>(null)

  const apply = useCallback(
    (clientX: number) => {
      const el = track.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      onChange(Math.round(min + ratio * (max - min)))
    },
    [min, max, onChange],
  )

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    apply(e.clientX)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) apply(e.clientX)
  }

  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="slider">
      <span className="slider-label">{label}</span>
      <div
        ref={track}
        className="slider-track"
        style={{ background: gradient }}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') onChange(Math.max(min, value - 1))
          if (e.key === 'ArrowRight') onChange(Math.min(max, value + 1))
        }}
      >
        <span className="slider-thumb" style={{ left: `${pct}%` }} />
      </div>
    </div>
  )
}

export function ColorPicker({
  value,
  swatches,
  onChange,
  onCommit,
}: {
  value: string
  swatches: string[]
  /** Fires continuously while dragging so the seat updates live. */
  onChange: (hex: string) => void
  /** Fires once when the interaction settles - the moment worth persisting. */
  onCommit?: (hex: string) => void
}) {
  const hsl = hexToHsl(value)
  const [draft, setDraft] = useState(value)

  const set = (next: Partial<typeof hsl>) => {
    const hex = hslToHex({ ...hsl, ...next })
    setDraft(hex)
    onChange(hex)
  }

  const hueTrack = `linear-gradient(to right, ${[0, 60, 120, 180, 240, 300, 360]
    .map((h) => hslToHex({ h, s: Math.max(hsl.s, 60), l: 50 }))
    .join(', ')})`

  return (
    <div className="picker" onPointerUp={() => onCommit?.(value)}>
      <Slider
        label="Hue"
        min={0}
        max={360}
        value={hsl.h}
        gradient={hueTrack}
        onChange={(h) => set({ h })}
      />
      <Slider
        label="Saturation"
        min={0}
        max={100}
        value={hsl.s}
        gradient={`linear-gradient(to right, ${hslToHex({ ...hsl, s: 0 })}, ${hslToHex({ ...hsl, s: 100 })})`}
        onChange={(s) => set({ s })}
      />
      <Slider
        label="Brightness"
        min={0}
        max={100}
        value={hsl.l}
        gradient={`linear-gradient(to right, #000, ${hslToHex({ ...hsl, l: 50 })}, #fff)`}
        onChange={(l) => set({ l })}
      />

      <div className="picker-row">
        <span className="picker-chip" style={{ background: value }} />
        <input
          className="picker-hex"
          value={draft}
          spellCheck={false}
          aria-label="Hex colour"
          onChange={(e) => {
            const next = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
            setDraft(next)
            if (isHex(next)) {
              onChange(next.toLowerCase())
              onCommit?.(next.toLowerCase())
            }
          }}
          onBlur={() => setDraft(value)}
        />
      </div>

      {swatches.length > 0 && (
        <div className="swatches">
          {swatches.map((hex) => (
            <button
              key={hex}
              className={`swatch${hex.toLowerCase() === value.toLowerCase() ? ' is-active' : ''}`}
              style={{ background: hex }}
              title={hex}
              aria-label={`Use ${hex}`}
              onClick={() => {
                setDraft(hex)
                onChange(hex)
                onCommit?.(hex)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
