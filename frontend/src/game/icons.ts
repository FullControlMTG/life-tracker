/**
 * Player symbols and counter icons.
 *
 * Each seat is assigned a distinct symbol at game start. Commander-damage
 * counters borrow the attacking player's symbol and colour, so a glance at a
 * counter tells you who the damage came from without reading any text.
 */

export type IconName =
  | 'crown' | 'sword' | 'skull' | 'flame' | 'leaf' | 'drop'
  | 'bolt' | 'star' | 'moon' | 'eye' | 'shield' | 'gem'
  | 'poison' | 'energy' | 'experience' | 'storm' | 'plus'

/** Filled SVG paths on a 24x24 grid. */
export const ICON_PATHS: Record<IconName, string> = {
  crown: 'M3 8l4 3 5-6 5 6 4-3-2 11H5L3 8z',
  sword: 'M14.5 3H21v6.5l-7.5 7.5-2-2 6-6V5h-4.5l2-2zM9.8 12.8l1.4 1.4-5.6 5.6-2.1.7.7-2.1 5.6-5.6z',
  skull: 'M12 2a8 8 0 00-8 8v3l2 2v3a2 2 0 002 2h8a2 2 0 002-2v-3l2-2v-3a8 8 0 00-8-8zM9 11a1.8 1.8 0 110-3.6A1.8 1.8 0 019 11zm6 0a1.8 1.8 0 110-3.6A1.8 1.8 0 0115 11z',
  flame: 'M12 2c1 4-3 5-3 9a3 3 0 006 0c0-1.5-.6-2.4-.6-2.4S17 11 17 14a5 5 0 01-10 0C7 8 12 7 12 2z',
  leaf: 'M20 4C9 4 4 9 4 16c0 1.5.4 3 1 4l2-2c-.3-4 2-8 8-9-3.5 2-6 5-6 9 0 0 9 2 11-14z',
  drop: 'M12 2.5S5 10 5 14.5a7 7 0 0014 0C19 10 12 2.5 12 2.5z',
  bolt: 'M13 2L4 14h6l-1 8 9-12h-6l1-8z',
  star: 'M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z',
  moon: 'M20 14.5A8.5 8.5 0 019.5 4 8.5 8.5 0 1020 14.5z',
  eye: 'M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 11a4 4 0 110-8 4 4 0 010 8zm0-2a2 2 0 100-4 2 2 0 000 4z',
  shield: 'M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5l8-3z',
  gem: 'M6 3h12l4 6-10 12L2 9l4-6zm.6 2L4.4 8.4h4.2L9.9 5H6.6zm5.4 0l-1.3 3.4h2.6L12 5zm2.1 0l1.3 3.4h4.2L17.4 5h-3.3z',
  poison: 'M9 2h6v3l3 6v8a3 3 0 01-3 3H9a3 3 0 01-3-3v-8l3-6V2zm1 12a2 2 0 104 0 2 2 0 00-4 0z',
  energy: 'M11 2L5 13h5l-1 9 8-12h-5l1-8h-2z',
  experience: 'M12 2l2.6 6.5L21 9.3l-4.8 4.4 1.3 6.3L12 16.8 6.5 20l1.3-6.3L3 9.3l6.4-.8L12 2z',
  storm: 'M6 10a5 5 0 019.6-2A4 4 0 1117 16H7a4 4 0 01-1-6zm5 8l-2 4h3l-1 4 4-6h-2l1-2h-3z',
  plus: 'M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7V4z',
}

/** Assigned to seats in order; the first six are the most visually distinct. */
export const PLAYER_SYMBOLS: IconName[] = [
  'crown', 'sword', 'flame', 'leaf', 'drop', 'bolt',
  'skull', 'star', 'moon', 'eye', 'shield', 'gem',
]

export const GENERIC_COUNTERS: { icon: IconName; label: string }[] = [
  { icon: 'poison', label: 'Poison' },
  { icon: 'energy', label: 'Energy' },
  { icon: 'experience', label: 'Experience' },
  { icon: 'storm', label: 'Storm' },
  { icon: 'star', label: 'Counter' },
]
