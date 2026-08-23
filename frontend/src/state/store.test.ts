import { describe, expect, it } from 'vitest'

import { clearProfileFromSeats } from './store'
import type { SeatState } from './store'

function seat(over: Partial<SeatState> = {}): SeatState {
  return {
    id: 'seat-1',
    facing: 'bottom',
    name: 'Marcus',
    life: 27,
    color: '#123456',
    background: 'color',
    card: null,
    symbol: 'crown',
    counters: [],
    profileId: 'p1',
    recentDelta: 0,
    ...over,
  }
}

describe('clearProfileFromSeats', () => {
  it('takes a deleted player off the seat entirely', () => {
    const [got] = clearProfileFromSeats([seat()], 'p1')

    expect(got.profileId).toBeNull()
    expect(got.name).toBe('Player 1')
    expect(got.color).not.toBe('#123456')
    expect(got.background).toBe('color')
    expect(got.card).toBeNull()
  })

  it('also drops their card artwork', () => {
    const withArt = seat({
      background: 'image',
      card: {
        scryfallId: 'abc',
        name: 'Lightning Bolt',
        imageUri: 'https://cards.scryfall.io/art_crop/a.jpg',
        focusX: 0.5,
        focusY: 0.5,
      },
    })
    const [got] = clearProfileFromSeats([withArt], 'p1')

    expect(got.card).toBeNull()
    expect(got.background).toBe('color')
  })

  // The game is still running - only the identity should go.
  it('keeps life and counters', () => {
    const playing = seat({
      life: 13,
      counters: [{ id: 'c1', kind: 'generic', icon: 'poison', label: 'Poison', value: 4 }],
    })
    const [got] = clearProfileFromSeats([playing], 'p1')

    expect(got.life).toBe(13)
    expect(got.counters).toHaveLength(1)
    expect(got.counters[0].value).toBe(4)
  })

  it('leaves other seats untouched', () => {
    const seats = [
      seat({ id: 'a', profileId: 'p1', name: 'Marcus' }),
      seat({ id: 'b', profileId: 'p2', name: 'Dana', color: '#abcdef' }),
    ]
    const got = clearProfileFromSeats(seats, 'p1')

    expect(got[0].name).toBe('Player 1')
    expect(got[1]).toEqual(seats[1])
  })

  it('clears every seat that player occupied', () => {
    const seats = [seat({ id: 'a' }), seat({ id: 'b' }), seat({ id: 'c', profileId: 'other' })]
    const got = clearProfileFromSeats(seats, 'p1')

    expect(got.filter((s) => s.profileId === 'p1')).toHaveLength(0)
    expect(got[0].name).toBe('Player 1')
    expect(got[1].name).toBe('Player 2')
    expect(got[2].profileId).toBe('other')
  })

  it('gives cleared seats their own default colour, not a shared one', () => {
    const seats = [seat({ id: 'a' }), seat({ id: 'b' })]
    const got = clearProfileFromSeats(seats, 'p1')
    expect(got[0].color).not.toBe(got[1].color)
  })

  it('is a no-op when nobody is using that profile', () => {
    const seats = [seat({ profileId: 'p9' })]
    expect(clearProfileFromSeats(seats, 'p1')).toEqual(seats)
  })
})
