import { useCallback, useEffect, useState } from 'react'

import {
  FULLSCREEN_EVENTS,
  enterFullscreen,
  isFullscreen,
  isFullscreenSupported,
  leaveFullscreen,
} from '../game/fullscreen'

export interface FullscreenState {
  /** False on iPhone Safari, which has no fullscreen API for regular elements. */
  supported: boolean
  active: boolean
  toggle: () => void
}

export function useFullscreen(): FullscreenState {
  // Read once during the first render; the capability cannot change at runtime.
  const [supported] = useState(() => isFullscreenSupported(document.documentElement))
  const [active, setActive] = useState(() => isFullscreen(document))

  useEffect(() => {
    // Leaving via Esc or the system gesture fires the same events, so the label
    // stays correct without tracking it ourselves.
    const sync = () => setActive(isFullscreen(document))
    sync()
    for (const evt of FULLSCREEN_EVENTS) document.addEventListener(evt, sync)
    return () => {
      for (const evt of FULLSCREEN_EVENTS) document.removeEventListener(evt, sync)
    }
  }, [])

  const toggle = useCallback(() => {
    const run = isFullscreen(document)
      ? leaveFullscreen(document)
      : enterFullscreen(document.documentElement)
    // A rejection here means the browser refused the request (no user gesture,
    // or an iframe without allowfullscreen). Nothing to recover, so keep state honest.
    void Promise.resolve(run)
      .catch(() => {})
      .then(() => setActive(isFullscreen(document)))
  }, [])

  return { supported, active, toggle }
}
