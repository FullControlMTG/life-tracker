import { useCallback, useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

/**
 * Press-and-hold repeat for the life buttons: fires once on press, then
 * accelerates while held. One pointer-event code path covers mouse and touch.
 */
export function useHold(onFire: () => void) {
  // Latest-callback ref, updated after commit so the handlers below stay stable
  // across renders without capturing a stale onFire.
  const fire = useRef(onFire)
  useEffect(() => {
    fire.current = onFire
  }, [onFire])

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stop = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  useEffect(() => stop, [stop])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      fire.current()

      let delay = 420
      const tick = () => {
        fire.current()
        delay = Math.max(55, delay * 0.7)
        timer.current = setTimeout(tick, delay)
      }
      timer.current = setTimeout(tick, delay)
    },
    [],
  )

  return { onPointerDown, onPointerUp: stop, onPointerCancel: stop, onLostPointerCapture: stop }
}
