import { ApiError } from './types'
import type {
  Bootstrap, Card, CardBackground, Profile, SessionInfo, Settings, User,
} from './types'

// Same-origin by default: in production the Go binary serves this bundle, and
// in development Vite proxies /api to it. Override only to point at a remote API.
const BASE = import.meta.env.VITE_API_BASE ?? '/api/v1'

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + path, {
      // The session lives in an HttpOnly cookie, so every call must send credentials.
      credentials: 'include',
      headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
      ...init,
    })
  } catch {
    throw new ApiError(0, 'network', 'Could not reach the server.')
  }

  if (res.status === 204) return undefined as T

  const text = await res.text()
  const body = text ? safeParse(text) : null

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.code ?? 'unknown',
      body?.message ?? `Request failed (${res.status})`,
      body?.fields,
    )
  }
  return body as T
}

function safeParse(text: string): any {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) })

export const api = {
  // --- auth ---
  register: (email: string, password: string, displayName: string) =>
    request<{ user: User }>('/auth/register', { method: 'POST', ...json({ email, password, displayName }) }),

  login: (email: string, password: string) =>
    request<{ user: User }>('/auth/login', { method: 'POST', ...json({ email, password }) }),

  logout: () => request<void>('/auth/logout', { method: 'POST' }),

  me: () => request<{ user: User }>('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>('/auth/password/change', { method: 'POST', ...json({ currentPassword, newPassword }) }),

  forgotPassword: (email: string) =>
    request<void>('/auth/password/forgot', { method: 'POST', ...json({ email }) }),

  resetPassword: (token: string, newPassword: string) =>
    request<void>('/auth/password/reset', { method: 'POST', ...json({ token, newPassword }) }),

  listSessions: () => request<{ sessions: SessionInfo[] }>('/auth/sessions'),

  revokeOtherSessions: () => request<void>('/auth/sessions', { method: 'DELETE' }),

  // --- bootstrap / settings ---
  bootstrap: () => request<Bootstrap>('/bootstrap'),

  saveSettings: (settings: Settings) =>
    request<{ settings: Settings }>('/settings', { method: 'PUT', ...json(settings) }),

  // --- profiles ---
  listProfiles: () => request<{ profiles: Profile[] }>('/profiles'),

  createProfile: (input: {
    displayName: string
    color: string
    background?: 'color' | 'image'
    symbol?: string
    card?: CardBackground | null
  }) => request<{ profile: Profile }>('/profiles', { method: 'POST', ...json(input) }),

  updateProfile: (id: string, patch: {
    displayName?: string
    color?: string
    background?: 'color' | 'image'
    symbol?: string
    card?: CardBackground
    clearCard?: boolean
  }) => request<{ profile: Profile }>(`/profiles/${id}`, { method: 'PATCH', ...json(patch) }),

  deleteProfile: (id: string) => request<void>(`/profiles/${id}`, { method: 'DELETE' }),

  pushColor: (id: string, hex: string) =>
    request<{ profile: Profile }>(`/profiles/${id}/colors`, { method: 'POST', ...json({ hex }) }),

  deleteColor: (id: string, hex: string) =>
    request<{ profile: Profile }>(`/profiles/${id}/colors/${encodeURIComponent(hex)}`, { method: 'DELETE' }),

  // --- cards ---
  searchCards: (q: string) =>
    request<{ cards: Card[] }>(`/cards/search?q=${encodeURIComponent(q)}`),

  autocompleteCards: (q: string) =>
    request<{ names: string[] }>(`/cards/autocomplete?q=${encodeURIComponent(q)}`),
}
