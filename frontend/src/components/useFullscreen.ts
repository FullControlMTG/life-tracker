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
  /**
   * The user asked for fullscreen and has not asked to leave. Fullscreen can be
   * dropped by things the page cannot veto - Escape, a reload, or the on-screen
   * keyboard on iPadOS - so this is what tells us to offer it back.
   */
  wanted: boolean
  toggle: () => void
  restore: () => void
}

const WANTED_KEY = 'life-tracker:fullscreen-wanted'

function readWanted(): boolean {
  try {
    return localStorage.getItem(WANTED_KEY) === '1'
  } catch {
    return false
  }
}

function writeWanted(value: boolean) {
  try {
    localStorage.setItem(WANTED_KEY, value ? '1' : '0')
  } catch {
    // Private mode and blocked storage are fine; the chip just will not persist.
  }
}

export function useFullscreen(): FullscreenState {
  // Read once during the first render; the capability cannot change at runtime.
  const [supported] = useState(() => isFullscreenSupported(document.documentElement))
  const [active, setActive] = useState(() => isFullscreen(document))
  const [wanted, setWanted] = useState(readWanted)

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

  const apply = useCallback((next: boolean) => {
    setWanted(next)
    writeWanted(next)
    const run = next ? enterFullscreen(document.documentElement) : leaveFullscreen(document)
    // A rejection means the browser refused (no user gesture, or an iframe
    // without allowfullscreen). Nothing to recover, so keep state honest.
    void Promise.resolve(run)
      .catch(() => {})
      .then(() => setActive(isFullscreen(document)))
  }, [])

  const toggle = useCallback(() => apply(!isFullscreen(document)), [apply])
  const restore = useCallback(() => apply(true), [apply])

  return { supported, active, wanted, toggle, restore }
}
