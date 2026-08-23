# Goals

## What the project does

Tracks life totals and auxiliary counters for in-person card games played around
a single shared device. The screen is divided so each player gets a rectangle
oriented toward the edge they are sitting at. Magic: The Gathering is the first
and currently only target game.

## Who it is for

People playing tabletop card games — primarily multiplayer Commander — who want a
shared phone or tablet in the middle of the table instead of dice, paper, or one
tracker app per person.

Two distinct user classes:

- **Anonymous visitors.** The full tracker works with no account and no network
  after first load. This is the primary path and must never regress.
- **Signed-in users.** Gain saved profiles for the people they regularly play
  with, so a seat can be populated by name with that person's colour and artwork.

## Current capabilities

- Three-step setup: player count (1–6), starting life, seating orientation.
- Eleven seating presets across the supported player counts.
- Tap or press-and-hold to change life; transient delta badge.
- Per-seat counters, including commander damage tagged with the attacking
  player's symbol and colour.
- Per-seat colour via touch-friendly HSL sliders, hex entry, and saved swatches.
- Card artwork backgrounds sourced from Scryfall, cropped rather than stretched,
  with an adjustable focal point.
- Email/password accounts with sessions, password change, password reset, and
  session listing/revocation.
- In-progress games survive a page refresh via `localStorage`.

## Priorities

1. Keep the anonymous path fully functional and fast.
2. Correctness of the seating/orientation model as new player counts or presets
   are added.
3. Legibility at a glance from across a table: large numerals, high contrast,
   large touch targets.

## Explicit non-goals

- **No multi-device or networked play.** Game state is local to one device.
  There is no server-side game record and no cross-device sync.
- **No rules engine.** The app tracks numbers; it does not know Magic's rules,
  validate life changes, or enforce game legality.
- **No deck management, collection tracking, or card prices.** Scryfall is used
  only as an artwork source.
- **No account-level colour palette.** Saved colours belong to individual
  profiles, capped at eight.
- **No social features.** Profiles are private to the account that created them;
  there is no sharing between accounts.
- **No self-hosted card images.** Artwork is referenced by Scryfall CDN URL.

## Known open questions

- TODO: whether other games (Yu-Gi-Oh!, Flesh and Blood, Pokémon) are intended
  targets, and on what timeline. The data model is game-agnostic but the presets
  and defaults are Magic-specific.
- TODO: whether server-side game persistence is wanted for cross-device resume.
  It was deliberately deferred from the first build.
