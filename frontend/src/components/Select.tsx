import { useEffect, useRef, useState } from 'react'

export interface SelectOption {
  value: string
  label: string
}

/**
 * A dropdown built from ordinary elements.
 *
 * A native <select> renders its option list as browser chrome, outside the
 * page's coordinate space, so it ignores the rotation on a seat menu and always
 * opens screen-up. Rendering the list in the DOM keeps it inside the rotated
 * frame, facing the player it belongs to.
 *
 * The list expands in flow rather than overlaying, because the sheet body is a
 * scroll container - an absolutely positioned list would be clipped by it.
 */
export function Select({
  value,
  options,
  placeholder = '— none —',
  label,
  onChange,
}: {
  value: string
  options: SelectOption[]
  placeholder?: string
  label: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const current = options.find((o) => o.value === value)

  const choose = (next: string) => {
    onChange(next)
    setOpen(false)
  }

  return (
    <div className="select" ref={wrap}>
      <button
        type="button"
        className="field select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={current ? '' : 'select-placeholder'}>{current?.label ?? placeholder}</span>
        <span className="select-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <ul className="select-list" role="listbox" aria-label={label}>
          {[{ value: '', label: placeholder }, ...options].map((o) => (
            <li key={o.value || '__none'}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={`select-option${o.value === value ? ' is-active' : ''}`}
                onClick={() => choose(o.value)}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
