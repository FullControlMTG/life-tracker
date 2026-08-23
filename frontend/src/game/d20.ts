/**
 * Face geometry for a top-down d20.
 *
 * Looking straight down at a resting icosahedron you see ten faces: the top
 * face, a ring of three sharing its edges, and six filling the gaps out to a
 * hexagonal silhouette. Building it from polar coordinates keeps the three-fold
 * symmetry exact, which a hand-drawn path would not.
 */

const CENTRE = 50
/** Silhouette radius. */
const R = 47
/** Radius of the top face. Sized so a two-digit roll sits on it rather than
 *  spilling across the facet edges. */
const TOP = 34

/** Polar to SVG coordinates, with 90 degrees pointing up. */
function point(degrees: number, radius: number): string {
  const a = (degrees * Math.PI) / 180
  return `${(CENTRE + radius * Math.cos(a)).toFixed(2)},${(CENTRE - radius * Math.sin(a)).toFixed(2)}`
}

const top = (deg: number) => point(deg, TOP)
const rim = (deg: number) => point(deg, R)

export interface Facet {
  points: string
  /** Flat shading, so the solid reads as three-dimensional without gradients. */
  opacity: number
}

export const D20_FACETS: Facet[] = [
  // The three gap faces on each side, furthest from the light.
  { points: [top(90), rim(150), rim(90)].join(' '), opacity: 0.34 },
  { points: [top(90), rim(90), rim(30)].join(' '), opacity: 0.26 },
  { points: [top(210), rim(270), rim(210)].join(' '), opacity: 0.34 },
  { points: [top(210), rim(210), rim(150)].join(' '), opacity: 0.2 },
  { points: [top(330), rim(30), rim(330)].join(' '), opacity: 0.26 },
  { points: [top(330), rim(330), rim(270)].join(' '), opacity: 0.2 },
  // The ring sharing edges with the top face.
  { points: [top(90), top(210), rim(150)].join(' '), opacity: 0.46 },
  { points: [top(210), top(330), rim(270)].join(' '), opacity: 0.42 },
  { points: [top(330), top(90), rim(30)].join(' '), opacity: 0.5 },
]

/** The face the number sits on. */
export const D20_TOP_FACE = [top(90), top(210), top(330)].join(' ')

export const D20_SILHOUETTE = [rim(90), rim(30), rim(330), rim(270), rim(210), rim(150)].join(' ')
