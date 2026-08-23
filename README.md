# life-tracker

An online life tracker for card games, built for Magic: The Gathering first.

The tracker itself needs no account — pick a player count, a starting life total
and a seating layout, and play. Signing in adds saved player profiles (name,
colour, saved swatches, card artwork) that can be loaded into any seat.

## Running it locally

```bash
cp .env.example .env   # POSTGRES_PASSWORD=lifetracker is fine locally
make install           # go mod download + npm install
make db                # Postgres 17 on 127.0.0.1:5433
make api               # Go API on :8080, applies migrations on boot
make web               # Vite dev server on :5173, proxying /api to :8080
```

Then open http://localhost:5173.

`make test` runs both suites. Configuration is all environment variables — see
[.env.example](.env.example).

Development is same-origin: Vite proxies `/api` to the Go process, matching
production where one binary serves both. Nothing exercises CORS in either.

## Deploying

One image contains both halves: [Dockerfile](Dockerfile) builds the SPA in a Node
stage and the API in a Go stage, then copies both into an Alpine runtime where
the Go binary serves the bundle from `STATIC_DIR` alongside `/api/v1`. It runs as
a non-root user, exposes `8080`, and its `HEALTHCHECK` probes `/healthz`.

[docker-compose.yml](docker-compose.yml) is the single file defining the whole
deployment. Two services on two networks:

```
            ┌── traefik (external, owned by Traefik) ──┐
 internet ──┤  life-tracker  :8080                     │
            └──────────┬───────────────────────────────┘
                       │ life-tracker-internal (bridge)
                       └── life-tracker-db  :5432   ← no published ports
```

Neither container publishes a port. Traefik discovers the app on the shared
external `traefik` network via labels and terminates TLS; the database sits only
on the `life-tracker-internal` bridge, reachable by the app and nothing else, and
keeps its data in a named volume.

```bash
cp .env.example .env     # set POSTGRES_PASSWORD (APP_DOMAIN if not the default)
make deploy              # docker compose build --pull && up -d
make deploy-down         # stops the stack, keeps the database volume
```

`APP_DOMAIN` defaults to `tracker.fullcontrolmtg.com`. `POSTGRES_PASSWORD` has no
default — compose refuses to start without it rather than come up with an empty
password.

[docker-compose.dev.yml](docker-compose.dev.yml) is not a second deployment: it
is a small overlay that adds a loopback port binding to the database so `make api`
can reach it from the host during development.

## CI

[Jenkinsfile](Jenkinsfile) is a declarative pipeline: **Checkout → Preflight →
Lint & Type-check → Teardown → Build & Deploy → Health Check → Smoke Test**, then
a Discord notification on every build and diagnostics capture on failure.

Preflight fails fast if a credential is unbound, Docker or Compose v2 is missing,
the external `traefik` network does not exist, or the compose file does not
validate. Lint and type-check run inside throwaway `golang` and `node` containers
so the agent needs no toolchains. Teardown never passes `-v`, so the database
volume survives a redeploy. Smoke Test asserts `/healthz` and the SPA shell from
inside the container, then hits `https://$APP_DOMAIN/healthz` to prove Traefik is
actually routing.

Required Jenkins credentials:

| Credential ID | Type | Used for |
|---|---|---|
| `life-tracker-postgres-password` | Secret text | Postgres password for the deployed stack |
| `discord-pws-builds-channel-webhook` | Secret text | Build-result notifications |

The pipeline deploys to `tracker.fullcontrolmtg.com`, set in the `Jenkinsfile`
`environment {}` block.

Agent-side knowledge files live in [.claude/](.claude/).

## How the screen is split

Every player region is a rectangle produced by 90° cuts only, and **every region
touches an outer edge of the screen**. That is the rule the whole layout system
rests on: a seat is rotated to face the edge its player sits at, so an interior
rectangle would have no edge to face.

A layout is therefore a binary split tree:

```ts
type LayoutNode =
  | { kind: 'seat'; facing: 'bottom' | 'top' | 'left' | 'right' }
  | { kind: 'split'; dir: 'row' | 'column'; children: LayoutNode[]; weights?: number[] }
```

which renders as nested flexboxes. Presets live in
[frontend/src/game/layout.ts](frontend/src/game/layout.ts) — adding a new seating
arrangement means adding a tree, not writing layout code.

```
2P "Across"          3P "Three up"        4P "All four edges"    6P "Full table"
┌───────────┐        ┌───────────┐        ┌─────────────┐        ┌─────────────┐
│  P1   ▼   │        │   P1  ▼   │        │    P1  ▼    │        │    P1  ▼    │
├───────────┤        ├─────┬─────┤        ├──────┬──────┤        ├──────┬──────┤
│  P2   ▲   │        │P2 ◀ │ ▶ P3│        │ P2 ◀ │ ▶ P3 │        │ P2 ◀ │ ▶ P4 │
└───────────┘        └─────┴─────┘        ├──────┴──────┤        ├──────┼──────┤
                                          │    P4  ▲    │        │ P3 ◀ │ ▶ P5 │
                                          └─────────────┘        ├──────┴──────┤
                                                                 │    P6  ▲    │
                                                                 └─────────────┘
```

Once you need three or more rows, every cell can only touch the left or right
edge — which is why the tall layouts are two columns wide.

A seat's outer element stays unrotated so a card background can fill it with
`object-fit: cover`, cropping on whichever axis overflows and never stretching
the art. Everything readable lives in an inner frame rotated to face that
player's edge; container query units (`100cqh` / `100cqw`) give the rotated frame
its swapped dimensions with no JavaScript measurement.

`frontend/src/game/layout.test.ts` asserts the invariant directly: for every
preset, each seat is against the edge it faces, and the seats tile the screen
exactly once.

## State

One state object lives in [frontend/src/state/store.ts](frontend/src/state/store.ts):

```ts
{
  phase: 'players' | 'life' | 'layout' | 'game',
  config: { playerCount, startingLife, layoutId },
  seats: Seat[],                       // life, colour, artwork, counters
  auth: { status, user },
  remote?: { settings, profiles }      // present only when signed in
}
```

`config` and `seats` are pure local game state and persist to `localStorage`, so
a mid-game refresh does not lose anyone's life total. `remote` is the optional
block fetched from the backend and is never persisted — it is re-fetched on load
so a stale profile list can never be shown to the wrong account. Writes go out
immediately over REST; nothing is batched.

## API

Everything is under `/api/v1`. Every authenticated route is implicitly scoped to
the session's user id — **a user id never appears in a path**.

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | `{email, password, displayName}`, sets session cookie |
| POST | `/auth/login` | `{email, password}` |
| POST | `/auth/logout` | revokes the current session |
| GET | `/auth/me` | current user, or 401 |
| POST | `/auth/password/change` | revokes every other session |
| POST | `/auth/password/forgot` | always 204, so it cannot enumerate accounts |
| POST | `/auth/password/reset` | `{token, newPassword}`, revokes all sessions |
| GET | `/auth/sessions` | active sessions with device and last-seen |
| DELETE | `/auth/sessions` | log out everywhere else |

### Bootstrap and settings
| Method | Path | Notes |
|---|---|---|
| GET | `/bootstrap` | `{user, settings, profiles}` in one call on page load |
| GET | `/settings` | |
| PUT | `/settings` | defaults for player count, life total, layout, theme |

### Profiles
| Method | Path | Notes |
|---|---|---|
| GET | `/profiles` | |
| POST | `/profiles` | |
| GET | `/profiles/{id}` | |
| PATCH | `/profiles/{id}` | partial; `clearCard: true` removes artwork |
| DELETE | `/profiles/{id}` | |
| POST | `/profiles/{id}/colors` | push a swatch — dedupes and evicts oldest past 8 |
| DELETE | `/profiles/{id}/colors/{hex}` | |

The 8-swatch cap lives on the server (and in a `CHECK` constraint) so the
eviction rule exists in exactly one place.

### Cards
| Method | Path | Notes |
|---|---|---|
| GET | `/cards/autocomplete?q=` | proxied and cached |
| GET | `/cards/search?q=` | distinct artworks, `art_crop` images |

Scryfall is proxied rather than called from the browser so its polite request
rate is enforced once, centrally, and responses are cached for 12 hours. Card
search works without an account.

Artwork is stored as a Scryfall CDN URL plus a focal point, not as a downloaded
blob. Image URIs are validated against `cards.scryfall.io` / `svgs.scryfall.io`
on write, because the value ends up in an `<img src>` and arbitrary URLs would
make profiles a tracking vector.

Errors always take one shape:

```json
{ "code": "invalid_request", "message": "check the highlighted fields",
  "fields": { "email": "that does not look like an email address" } }
```

## Layout of the repo

```
backend/
  cmd/server/            entrypoint: connect, migrate, serve, graceful shutdown
  internal/auth/         argon2id hashing, opaque session tokens
  internal/config/       environment configuration
  internal/httpapi/      router, middleware, handlers, validation
  internal/migrations/   embedded SQL, applied on boot
  internal/models/       domain types shared by store and API
  internal/scryfall/     cached, rate-limited upstream client
  internal/store/        Store interface + Postgres implementation
frontend/
  src/api/               typed client for the endpoints above
  src/components/        seat, split layout, colour picker, card search, menus
  src/game/              layout trees, colour maths, icons
  src/screens/           the three setup steps and the game board
  src/state/store.ts     the single state object
```

Handlers depend on the `Store` interface, not on Postgres, so the persistence
layer can be swapped or faked in tests.

## Security notes

- Passwords are argon2id (64 MiB, 2 passes); a login costs the same whether or
  not the email exists.
- Sessions are opaque 256-bit tokens; only their SHA-256 is stored, so a database
  leak hands out no live sessions. Cookies are `HttpOnly; SameSite=Lax; Secure`
  outside development.
- Credential endpoints are rate limited per IP. The limiter is process-local —
  move it to a shared store before running more than one replica.
- Password reset emails are not wired up yet: `POST /auth/password/forgot` logs
  the reset token instead of sending it, which keeps the flow testable end to
  end. Swap that one call for an SMTP send when mail exists.
