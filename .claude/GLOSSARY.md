# Glossary

## Project terms

**Seat** — one player's rectangle on screen. Holds a life total, a name, a
background (colour or card art), a symbol, and any counters. Distinct from a
*profile*: a seat is a position in the current game, a profile is a saved person.

**Profile** — a saved player belonging to one account: display name, colour, up
to eight saved colours, and optional card artwork. Loading a profile into a seat
copies those values in. Profiles are private to the account that created them.

**Facing** — the screen edge a seat's player sits at (`bottom`, `top`, `left`,
`right`). Determines the seat's rotation: 0°, 180°, 90°, 270° respectively.

**Layout / preset** — a named seating arrangement for a given player count,
expressed as a split tree. Eleven ship today, identified by strings like
`4p-edges`.

**Split tree** — the recursive structure describing how the screen is divided. A
node is either a *seat* leaf or a *split* with a direction, children, and
optional weights.

**Rotor** (`.seat-rotor`) — the inner element of a seat holding everything
readable. It is rotated to face the player; the outer seat rectangle is not, so
background art crops correctly.

**Sheet** (`SeatSheet`) — the per-seat settings panel, with Player / Colour /
Art / Counters tabs. Rendered through a portal but rotated to match its seat.

**Swatch history / saved colours** — the per-profile list of recently used
colours, capped at eight, newest first, deduplicated case-insensitively.

**Focal point** (`focusX`, `focusY`) — two 0–1 floats fed to CSS
`object-position`, choosing which part of a card image survives the crop.

**Bootstrap** — `GET /api/v1/bootstrap`, the single call made on page load
returning user, settings and profiles together. Returns 401 for anonymous
visitors, which is the normal path rather than an error.

**Remote block** — the optional `remote` branch of the frontend state object,
present only when signed in. Never persisted to `localStorage`.

**Phase** — which screen is showing: `players`, `life`, `layout`, or `game`.

## Magic: The Gathering terms

**Commander** — a multiplayer Magic format, usually four players, starting at 40
life. The primary use case; 40 is the default starting life.

**Commander damage** — damage dealt by a specific opponent's commander, tracked
per opponent. A player loses on 21 from any single commander, so each source must
be counted separately. In the app these are counters tagged with the attacking
seat's symbol and colour.

**Poison / Energy / Experience / Storm** — other Magic counters offered as
generic per-seat counters.

**Brawl**, **Two-headed Giant** — Magic formats appearing as starting-life
presets (30 and 25).

**Scryfall** — a public Magic card database and image CDN, the artwork source.
See <https://scryfall.com/docs/api>.

**Art crop** (`art_crop`) — a Scryfall image variant containing only the
illustration, without the card frame or text box. The variant used for seat
backgrounds.

## Infrastructure terms

**Traefik** — the reverse proxy on the deployment node. Discovers containers on
the shared external `traefik` Docker network via labels and terminates TLS. The
app container publishes no ports.

**`life-tracker-internal`** — the private bridge network carrying app-to-database
traffic. Postgres is on this network only, so it is reachable by the app and
nothing else.

**Dev overlay** (`docker-compose.dev.yml`) — a small compose overlay applied on
top of `docker-compose.yml` for local development. Its only effect is publishing
the database on `127.0.0.1:5433` so a host-run backend can connect.

**PWS** — the organisation whose Definition of Done this project follows; see
`whitney-server/pws-prompt-engineering`.

**DoD (Definition of Done)** — the deployment standard requiring a root
`Dockerfile`, a Traefik-integrated `docker-compose.yml`, a `Jenkinsfile`, and a
`.claude/` knowledge folder.

**`lets-encrypt`** — the Traefik certificate resolver name referenced in the
router labels. Must match the resolver configured on the Traefik instance.
