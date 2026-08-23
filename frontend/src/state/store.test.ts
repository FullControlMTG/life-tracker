import { describe, expect, it } from 'vitest'

import { assignSymbol, clearProfileFromSeats, detachSeat, symbolsTakenByOthers } from './store'
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

describe('assignSymbol', () => {
  const table = () => [
    seat({ id: 'a', symbol: 'crown' }),
    seat({ id: 'b', symbol: 'sword' }),
    seat({ id: 'c', symbol: 'flame' }),
  ]

  it('assigns a symbol nobody is using', () => {
    const got = assignSymbol(table(), 'a', 'skull')
    expect(got.find((s) => s.id === 'a')!.symbol).toBe('skull')
  })

  // Commander-damage counters are identified by symbol, so a duplicate would
  // make it impossible to tell who dealt the damage.
  it('refuses a symbol another seat already wears', () => {
    const before = table()
    const got = assignSymbol(before, 'a', 'sword')
    expect(got.find((s) => s.id === 'a')!.symbol).toBe('crown')
    expect(got.find((s) => s.id === 'b')!.symbol).toBe('sword')
    expect(got).toBe(before)
  })

  it('lets a seat keep its own symbol', () => {
    const got = assignSymbol(table(), 'a', 'crown')
    expect(got.find((s) => s.id === 'a')!.symbol).toBe('crown')
  })

  it('never lets two seats share a symbol, whatever is requested', () => {
    let seats = table()
    for (const wanted of ['sword', 'flame', 'crown', 'moon', 'sword', 'moon'] as const) {
      for (const id of ['a', 'b', 'c']) {
        seats = assignSymbol(seats, id, wanted)
        const symbols = seats.map((s) => s.symbol)
        expect(new Set(symbols).size, `duplicate after ${id} asked for ${wanted}`).toBe(symbols.length)
      }
    }
  })

  it('leaves other seats alone', () => {
    const before = table()
    const got = assignSymbol(before, 'a', 'moon')
    expect(got[1]).toEqual(before[1])
    expect(got[2]).toEqual(before[2])
  })
})

describe('symbolsTakenByOthers', () => {
  it('excludes the seat asking', () => {
    const seats = [seat({ id: 'a', symbol: 'crown' }), seat({ id: 'b', symbol: 'sword' })]
    const taken = symbolsTakenByOthers(seats, 'a')
    expect(taken.has('sword')).toBe(true)
    expect(taken.has('crown')).toBe(false)
  })

  it('is empty for a single seat', () => {
    expect(symbolsTakenByOthers([seat({ id: 'a' })], 'a').size).toBe(0)
  })
})

describe('detachSeat', () => {
  const loaded = () =>
    seat({
      id: 'a',
      profileId: 'p1',
      name: 'Marcus',
      color: '#123456',
      background: 'image',
      card: {
        scryfallId: 'abc',
        name: 'Lightning Bolt',
        imageUri: 'https://cards.scryfall.io/art_crop/a.jpg',
        focusX: 0.5,
        focusY: 0.5,
      },
      life: 17,
      counters: [{ id: 'c1', kind: 'generic', icon: 'poison', label: 'Poison', value: 3 }],
    })

  // Picking "none" has to undo everything loading a profile did.
  it('clears the name, colour and artwork, not just the id', () => {
    const [got] = detachSeat([loaded()], 'a')
    expect(got.profileId).toBeNull()
    expect(got.name).toBe('Player 1')
    expect(got.color).not.toBe('#123456')
    expect(got.background).toBe('color')
    expect(got.card).toBeNull()
  })

  it('keeps the game state on that seat', () => {
    const [got] = detachSeat([loaded()], 'a')
    expect(got.life).toBe(17)
    expect(got.counters).toHaveLength(1)
    expect(got.symbol).toBe('crown')
  })

  it('leaves other seats alone', () => {
    const seats = [loaded(), seat({ id: 'b', name: 'Dana', profileId: 'p2' })]
    const got = detachSeat(seats, 'a')
    expect(got[1]).toEqual(seats[1])
  })

  it('gives each seat back its own default colour', () => {
    const seats = [loaded(), seat({ id: 'b', profileId: 'p1', color: '#123456' })]
    const got = detachSeat(detachSeat(seats, 'a'), 'b')
    expect(got[0].color).not.toBe(got[1].color)
    expect(got[0].name).toBe('Player 1')
    expect(got[1].name).toBe('Player 2')
  })

  // Both paths back to an empty seat must land in the same place.
  it('matches what deleting the profile does', () => {
    const seats = [loaded()]
    expect(detachSeat(seats, 'a')).toEqual(clearProfileFromSeats(seats, 'p1'))
  })

  it('is a no-op for an unknown seat', () => {
    const seats = [loaded()]
    expect(detachSeat(seats, 'nope')).toEqual(seats)
  })
})
