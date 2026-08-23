/**
 * The single frontend state object.
 *
 * Everything under `config` / `seats` is pure local game state and works with
 * no network at all. `remote` is the optional block pulled from the backend and
 * is populated only when a session cookie resolves to a user. Writes go out
 * immediately over REST (no batching) and the response is folded back in.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { api } from '../api/client'
import { ApiError } from '../api/types'
import type { CardBackground, Profile, Settings, User } from '../api/types'
import { facingOrder, layoutById, layoutsFor } from '../game/layout'
import type { Facing } from '../game/layout'
import { PLAYER_SYMBOLS } from '../game/icons'
import type { IconName } from '../game/icons'

export type Phase = 'players' | 'life' | 'layout' | 'game'

export interface Counter {
  id: string
  /** 'commander' counters carry the attacking seat's identity. */
  kind: 'commander' | 'generic'
  icon: IconName
  label: string
  value: number
  /** Tint for commander counters, so the source player is obvious at a glance. */
  color?: string
  sourceSeatId?: string
}

export interface SeatState {
  id: string
  facing: Facing
  name: string
  life: number
  color: string
  background: 'color' | 'image'
  card: CardBackground | null
  symbol: IconName
  counters: Counter[]
  profileId: string | null
  /** Sum of the last few adjustments, shown as a transient "+3" and then cleared. */
  recentDelta: number
}

export interface GameConfig {
  playerCount: number
  startingLife: number
  layoutId: string
}

interface AuthState {
  status: 'unknown' | 'anon' | 'authed'
  user: User | null
}

interface RemoteState {
  settings: Settings
  profiles: Profile[]
}

export interface AppState {
  phase: Phase
  config: GameConfig
  seats: SeatState[]
  auth: AuthState
  remote: RemoteState | null

  // navigation
  goto: (phase: Phase) => void
  setPlayerCount: (n: number) => void
  setStartingLife: (n: number) => void
  startGame: (layoutId: string) => void
  newGame: () => void
  restartGame: () => void

  // in-game
  adjustLife: (seatId: string, delta: number) => void
  setSeatColor: (seatId: string, hex: string) => void
  setSeatCard: (seatId: string, card: CardBackground | null) => void
  setSeatName: (seatId: string, name: string) => void
  applyProfile: (seatId: string, profileId: string | null) => void
  addCounter: (seatId: string, counter: Omit<Counter, 'id' | 'value'> & { value?: number }) => void
  adjustCounter: (seatId: string, counterId: string, delta: number) => void
  removeCounter: (seatId: string, counterId: string) => void

  // backend
  hydrate: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => Promise<void>
  saveSettings: (patch: Partial<Settings>) => Promise<void>
  createProfileFromSeat: (seatId: string, displayName: string) => Promise<Profile>
  updateProfile: (id: string, patch: Parameters<typeof api.updateProfile>[1]) => Promise<Profile>
  deleteProfile: (id: string) => Promise<void>
  rememberColor: (profileId: string, hex: string) => Promise<void>
}

// Matched luminance (~5:1 against white text), so no seat reads washed out
// next to another. See readableInk in game/color.ts for the contrast rule.
const DEFAULT_COLORS = [
  '#376eae', '#bc3f5e', '#2b7b4c', '#8a52bc', '#8b652c', '#2c7684',
]

const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2)}`

function buildSeats(config: GameConfig, previous: SeatState[] = []): SeatState[] {
  const preset = layoutById(config.layoutId)
  if (!preset) return []
  const facings = facingOrder(preset.root)

  return facings.map((facing, i) => {
    // Carry over identity (name/colour/profile) when re-seating an existing game.
    const prev = previous[i]
    return {
      id: prev?.id ?? uid(),
      facing,
      name: prev?.name ?? `Player ${i + 1}`,
      life: config.startingLife,
      color: prev?.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
      background: prev?.background ?? 'color',
      card: prev?.card ?? null,
      symbol: PLAYER_SYMBOLS[i % PLAYER_SYMBOLS.length],
      counters: [],
      profileId: prev?.profileId ?? null,
      recentDelta: 0,
    }
  })
}

/** Timers that clear the transient life-change badge, kept out of state. */
const deltaTimers = new Map<string, ReturnType<typeof setTimeout>>()

export const useStore = create<AppState>()(
  persist(
    (set, get) => {
      const patchSeat = (seatId: string, fn: (s: SeatState) => SeatState) =>
        set((state) => ({ seats: state.seats.map((s) => (s.id === seatId ? fn(s) : s)) }))

      return {
        phase: 'players',
        config: { playerCount: 4, startingLife: 40, layoutId: '' },
        seats: [],
        auth: { status: 'unknown', user: null },
        remote: null,

        goto: (phase) => set({ phase }),

        setPlayerCount: (n) =>
          set((state) => ({
            config: {
              ...state.config,
              playerCount: n,
              // A layout is only valid for its own player count.
              layoutId: layoutById(state.config.layoutId)?.players === n ? state.config.layoutId : '',
            },
          })),

        setStartingLife: (n) =>
          set((state) => ({ config: { ...state.config, startingLife: Math.max(1, Math.min(999, n)) } })),

        startGame: (layoutId) =>
          set((state) => {
            const config = { ...state.config, layoutId }
            return { config, seats: buildSeats(config), phase: 'game' as Phase }
          }),

        newGame: () => set({ phase: 'players', seats: [] }),

        restartGame: () =>
          set((state) => ({ seats: buildSeats(state.config, state.seats) })),

        adjustLife: (seatId, delta) => {
          patchSeat(seatId, (s) => ({
            ...s,
            life: s.life + delta,
            recentDelta: s.recentDelta + delta,
          }))
          clearTimeout(deltaTimers.get(seatId))
          deltaTimers.set(
            seatId,
            setTimeout(() => patchSeat(seatId, (s) => ({ ...s, recentDelta: 0 })), 1600),
          )
        },

        setSeatColor: (seatId, hex) =>
          patchSeat(seatId, (s) => ({ ...s, color: hex, background: 'color' })),

        setSeatCard: (seatId, card) =>
          patchSeat(seatId, (s) => ({
            ...s,
            card,
            background: card ? 'image' : 'color',
          })),

        setSeatName: (seatId, name) => patchSeat(seatId, (s) => ({ ...s, name })),

        applyProfile: (seatId, profileId) => {
          if (profileId === null) {
            patchSeat(seatId, (s) => ({ ...s, profileId: null }))
            return
          }
          const profile = get().remote?.profiles.find((p) => p.id === profileId)
          if (!profile) return
          patchSeat(seatId, (s) => ({
            ...s,
            profileId: profile.id,
            name: profile.displayName,
            color: profile.color,
            background: profile.background,
            card: profile.card,
          }))
        },

        addCounter: (seatId, counter) =>
          patchSeat(seatId, (s) => ({
            ...s,
            counters: [...s.counters, { ...counter, id: uid(), value: counter.value ?? 0 }],
          })),

        adjustCounter: (seatId, counterId, delta) =>
          patchSeat(seatId, (s) => ({
            ...s,
            counters: s.counters.map((c) =>
              c.id === counterId ? { ...c, value: Math.max(0, c.value + delta) } : c,
            ),
          })),

        removeCounter: (seatId, counterId) =>
          patchSeat(seatId, (s) => ({ ...s, counters: s.counters.filter((c) => c.id !== counterId) })),

        // --- backend ---------------------------------------------------

        hydrate: async () => {
          try {
            const data = await api.bootstrap()
            set({
              auth: { status: 'authed', user: data.user },
              remote: { settings: data.settings, profiles: data.profiles },
            })
            // Adopt saved defaults, but never clobber a game already in progress.
            if (get().phase === 'players') {
              set((state) => ({
                config: {
                  playerCount: data.settings.defaultPlayerCount,
                  startingLife: data.settings.defaultStartingLife,
                  layoutId:
                    layoutsFor(data.settings.defaultPlayerCount)
                      .some((l) => l.id === data.settings.defaultLayoutId)
                      ? data.settings.defaultLayoutId
                      : state.config.layoutId,
                },
              }))
            }
          } catch (err) {
            // 401 is the normal anonymous path, not a failure.
            if (err instanceof ApiError && err.status === 401) {
              set({ auth: { status: 'anon', user: null }, remote: null })
              return
            }
            set({ auth: { status: 'anon', user: null }, remote: null })
          }
        },

        login: async (email, password) => {
          await api.login(email, password)
          await get().hydrate()
        },

        register: async (email, password, displayName) => {
          await api.register(email, password, displayName)
          await get().hydrate()
        },

        logout: async () => {
          await api.logout()
          set({ auth: { status: 'anon', user: null }, remote: null })
          // Detach seats from profiles they can no longer resolve.
          set((state) => ({ seats: state.seats.map((s) => ({ ...s, profileId: null })) }))
        },

        saveSettings: async (patch) => {
          const remote = get().remote
          if (!remote) return
          const next = { ...remote.settings, ...patch }
          set({ remote: { ...remote, settings: next } }) // optimistic
          const { settings } = await api.saveSettings(next)
          set((state) => (state.remote ? { remote: { ...state.remote, settings } } : {}))
        },

        createProfileFromSeat: async (seatId, displayName) => {
          const seat = get().seats.find((s) => s.id === seatId)
          if (!seat) throw new Error('no such seat')
          const { profile } = await api.createProfile({
            displayName,
            color: seat.color,
            background: seat.background,
            card: seat.card,
          })
          set((state) =>
            state.remote ? { remote: { ...state.remote, profiles: sortProfiles([...state.remote.profiles, profile]) } } : {},
          )
          patchSeat(seatId, (s) => ({ ...s, profileId: profile.id, name: profile.displayName }))
          return profile
        },

        updateProfile: async (id, patch) => {
          const { profile } = await api.updateProfile(id, patch)
          set((state) =>
            state.remote
              ? {
                  remote: {
                    ...state.remote,
                    profiles: sortProfiles(state.remote.profiles.map((p) => (p.id === id ? profile : p))),
                  },
                }
              : {},
          )
          return profile
        },

        deleteProfile: async (id) => {
          await api.deleteProfile(id)
          set((state) => ({
            remote: state.remote
              ? { ...state.remote, profiles: state.remote.profiles.filter((p) => p.id !== id) }
              : null,
            seats: state.seats.map((s) => (s.profileId === id ? { ...s, profileId: null } : s)),
          }))
        },

        rememberColor: async (profileId, hex) => {
          const { profile } = await api.pushColor(profileId, hex)
          set((state) =>
            state.remote
              ? {
                  remote: {
                    ...state.remote,
                    profiles: state.remote.profiles.map((p) => (p.id === profileId ? profile : p)),
                  },
                }
              : {},
          )
        },
      }
    },
    {
      name: 'life-tracker',
      version: 1,
      // Only game state survives a refresh. Auth and remote data are always
      // re-fetched, so a stale profile list can never be shown to the wrong user.
      partialize: (state) => ({ phase: state.phase, config: state.config, seats: state.seats }),
    },
  ),
)

function sortProfiles(profiles: Profile[]): Profile[] {
  return [...profiles].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }),
  )
}
