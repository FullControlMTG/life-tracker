import { describe, expect, it, vi } from 'vitest'

import {
  enterFullscreen,
  fullscreenElementOf,
  isFullscreen,
  isFullscreenSupported,
  leaveFullscreen,
} from './fullscreen'

describe('fullscreen', () => {
  it('detects the standard API', () => {
    expect(isFullscreenSupported({ requestFullscreen: vi.fn() })).toBe(true)
  })

  // Safari on macOS and iPadOS only has the prefixed spelling.
  it('detects the webkit-prefixed API', () => {
    expect(isFullscreenSupported({ webkitRequestFullscreen: vi.fn() })).toBe(true)
  })

  // iPhone Safari exposes neither, so the button must not be offered.
  it('reports unsupported when neither exists', () => {
    expect(isFullscreenSupported({})).toBe(false)
    expect(isFullscreenSupported(null)).toBe(false)
    expect(isFullscreenSupported(undefined)).toBe(false)
  })

  it('prefers the standard API when both are present', async () => {
    const std = vi.fn().mockResolvedValue(undefined)
    const webkit = vi.fn()
    await enterFullscreen({ requestFullscreen: std, webkitRequestFullscreen: webkit })
    expect(std).toHaveBeenCalledOnce()
    expect(webkit).not.toHaveBeenCalled()
  })

  it('falls back to webkit when the standard API is absent', async () => {
    const webkit = vi.fn()
    await enterFullscreen({ webkitRequestFullscreen: webkit })
    expect(webkit).toHaveBeenCalledOnce()
  })

  it('throws rather than silently doing nothing when unsupported', async () => {
    await expect(enterFullscreen({})).rejects.toThrow(/not supported/)
  })

  it('exits through whichever spelling exists', async () => {
    const std = vi.fn().mockResolvedValue(undefined)
    await leaveFullscreen({ exitFullscreen: std })
    expect(std).toHaveBeenCalledOnce()

    const webkit = vi.fn()
    await leaveFullscreen({ webkitExitFullscreen: webkit })
    expect(webkit).toHaveBeenCalledOnce()
  })

  it('exiting when not fullscreen is a no-op, not a crash', async () => {
    await expect(leaveFullscreen({})).resolves.toBeUndefined()
  })

  it('reads the active element from either spelling', () => {
    const el = {} as Element
    expect(fullscreenElementOf({ fullscreenElement: el })).toBe(el)
    expect(fullscreenElementOf({ webkitFullscreenElement: el })).toBe(el)
    expect(fullscreenElementOf({ fullscreenElement: null })).toBeNull()
    expect(fullscreenElementOf(undefined)).toBeNull()
  })

  it('reports fullscreen state', () => {
    expect(isFullscreen({ fullscreenElement: {} as Element })).toBe(true)
    expect(isFullscreen({ fullscreenElement: null })).toBe(false)
  })

})
