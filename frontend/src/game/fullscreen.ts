/**
 * Fullscreen across the browsers this app actually runs on.
 *
 * Chrome, Edge, Firefox and Android use the standard API. Safari on macOS and
 * iPadOS only has the webkit-prefixed one. Safari on iPhone has neither - it
 * exposes fullscreen for <video> only - so there the control is simply not
 * offered.
 *
 * The document and element are passed in rather than read from globals so the
 * prefix handling can be tested against fakes.
 */

export interface FullscreenDocument {
  fullscreenElement?: Element | null
  webkitFullscreenElement?: Element | null
  exitFullscreen?: () => Promise<void>
  webkitExitFullscreen?: () => Promise<void> | void
}

export interface FullscreenElement {
  requestFullscreen?: (options?: FullscreenOptions) => Promise<void>
  webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void> | void
}

export function isFullscreenSupported(el: FullscreenElement | null | undefined): boolean {
  if (!el) return false
  return typeof el.requestFullscreen === 'function' || typeof el.webkitRequestFullscreen === 'function'
}

export function fullscreenElementOf(doc: FullscreenDocument | null | undefined): Element | null {
  if (!doc) return null
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null
}

export function isFullscreen(doc: FullscreenDocument | null | undefined): boolean {
  return fullscreenElementOf(doc) !== null
}

export async function enterFullscreen(el: FullscreenElement): Promise<void> {
  if (typeof el.requestFullscreen === 'function') {
    await el.requestFullscreen({ navigationUI: 'hide' })
    return
  }
  if (typeof el.webkitRequestFullscreen === 'function') {
    await el.webkitRequestFullscreen()
    return
  }
  throw new Error('fullscreen is not supported here')
}

export async function leaveFullscreen(doc: FullscreenDocument): Promise<void> {
  if (typeof doc.exitFullscreen === 'function') {
    await doc.exitFullscreen()
    return
  }
  if (typeof doc.webkitExitFullscreen === 'function') {
    await doc.webkitExitFullscreen()
  }
}

/** Both spellings fire, so listen for both and dedupe by re-reading the state. */
export const FULLSCREEN_EVENTS = ['fullscreenchange', 'webkitfullscreenchange'] as const

