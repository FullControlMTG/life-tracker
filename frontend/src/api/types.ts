/** Wire types mirroring the Go models in backend/internal/models. */

export interface User {
  id: string
  email: string
  displayName: string
  createdAt: string
  updatedAt: string
}

export interface Settings {
  defaultPlayerCount: number
  defaultStartingLife: number
  defaultLayoutId: string
  theme: 'dark' | 'light'
  hapticsEnabled: boolean
  updatedAt: string
}

export interface CardBackground {
  scryfallId: string
  name: string
  imageUri: string
  /** Focal point, 0-1, fed to CSS object-position so the crop keeps the art. */
  focusX: number
  focusY: number
}

export interface Profile {
  id: string
  displayName: string
  color: string
  background: 'color' | 'image'
  card: CardBackground | null
  savedColors: string[]
  createdAt: string
  updatedAt: string
}

export interface SessionInfo {
  id: string
  userAgent: string
  ip: string
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  current: boolean
}

export interface Bootstrap {
  user: User
  settings: Settings
  profiles: Profile[]
}

export interface Card {
  scryfallId: string
  name: string
  setName: string
  artCropUri: string
  normalUri: string
}

/** The single error shape the API returns. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields: Record<string, string>

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields ?? {}
  }
}
