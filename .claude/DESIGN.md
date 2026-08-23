# Design

## Component overview

```
Browser
  React SPA ── Zustand store (single state object)
       │             ├── config + seats  → localStorage
       │             └── remote          → HTTP only, never persisted
       │ /api/v1  (same origin)
       ▼
Go binary (one process)
  chi router
    ├── /api/v1/*      handlers → Store interface → Postgres
    ├── /api/v1/cards  → scryfall.Client (cached, rate-limited) → api.scryfall.com
    ├── /healthz
    └── everything else → static SPA handler (index.html fallback)
       │
       ▼
Postgres 17   (users, sessions, password_resets, user_settings, profiles)
```

In production one container serves both the SPA and the API. In development Vite
serves the SPA on `:5173` and proxies `/api` to the Go process on `:8080`, so
both environments are same-origin.

## Key design decisions

### Layouts are binary split trees, not hardcoded CSS

**Decision.** A seating arrangement is data:

```ts
type LayoutNode =
  | { kind: 'seat'; facing: 'bottom' | 'top' | 'left' | 'right' }
  | { kind: 'split'; dir: 'row' | 'column'; children: LayoutNode[]; weights?: number[] }
```

rendered as nested flexboxes.

**Reasoning.** The requirement was that each edge of the device points at a
player and the screen only ever splits at 90 degrees. That forces one invariant:
**every seat rectangle must touch an outer edge of the screen**, because a seat
rotates to face the edge its player sits at, and an interior rectangle has no
edge to face. A split tree expresses exactly the set of layouts that right-angle
cuts can produce, so adding a preset means adding a tree rather than writing
layout code.

**Consequence.** Once a layout has three or more rows, every cell can only reach
the left or right edge — which is why the five- and six-player presets are two
columns wide. This is a property of the constraint, not an arbitrary choice.

**Enforcement.** `frontend/src/game/layout.test.ts` computes each seat's
rectangle and asserts it touches the edge it faces, and that seats tile the
screen exactly once with no overlap.

### The seat rectangle stays unrotated; an inner frame rotates

**Decision.** `.seat` is the real rectangle and is never rotated. Card art fills
it with `object-fit: cover`. All readable content lives in `.seat-rotor`, which
is rotated by `ROTATION[facing]`.

**Reasoning.** Rotating the outer element would rotate the background image with
it and require re-deriving the crop. Keeping the rectangle axis-aligned means the
browser crops the art on whichever axis overflows and never distorts it.

**Mechanism.** For quarter-turn seats the rotated frame needs swapped
dimensions. `.seat` declares `container-type: size` and the rotor uses
`width: 100cqh; height: 100cqw`, so the swap comes from CSS with no
`ResizeObserver` or JavaScript measurement.

**Alternative rejected.** Measuring seat size in JavaScript and setting pixel
dimensions — more code, a resize listener, and a frame of visible wrongness on
orientation change.

### The seat menu portals out but keeps its rotation

**Decision.** `SeatSheet` renders through `createPortal` into `document.body` as
a centred overlay, with `transform: rotate(...)` matching the seat's facing and
sizing in `vmin`.

**Reasoning.** A seat can be a short band — a 1024×768 four-player layout gives
the end seats about 230px of height, which cannot hold a form. Rendering inside
the seat clipped the colour picker. Portaling frees the panel from the rectangle;
keeping the rotation means a player at the left edge still reads it upright
without anyone turning the device. `vmin` sizing guarantees the panel fits after
a quarter turn.

### One state object, with the remote block quarantined

**Decision.**

```ts
{ phase, config, seats, auth, remote? }
```

`config` and `seats` persist to `localStorage`. `auth` and `remote` never do.

**Reasoning.** Persisting game state means a mid-game refresh does not lose
anyone's life total. Deliberately *not* persisting `remote` means a stale profile
list can never be shown to the wrong account — it is always re-fetched from
`/bootstrap`, which is authoritative.

### Writes are immediate, not batched

**Decision.** Each profile or settings change fires its own REST call and folds
the response back into state.

**Reasoning.** Write volume is tiny — a colour change or a profile save, both
human-paced. Batching would add reconciliation and conflict handling for no
measurable benefit.

### Card art is a URL plus a focal point, not a stored blob

**Decision.** A profile stores `{scryfallId, name, imageUri, focusX, focusY}`.
The backend proxies Scryfall search but never downloads images.

**Reasoning.** Avoids blob storage, an image pipeline, cleanup, and an abuse
surface. Scryfall's CDN serves the art; cropping happens in CSS via
`object-position`, so the focal point costs two floats.

**Trade-off.** If Scryfall changes or expires an image URI, saved backgrounds
break. Accepted; re-picking the art is cheap.

**Security consequence.** The stored URI lands in an `<img src>`, so accepting
arbitrary URLs would make profiles an SSRF and tracking vector. `validateCard`
allowlists `cards.scryfall.io` and `svgs.scryfall.io` over HTTPS.

### Scryfall is proxied rather than called from the browser

**Reasoning.** Scryfall asks for 50–100ms between requests. Enforcing that
centrally in `scryfall.Client` — one mutex-gated call site plus a 12-hour
response cache — is possible only server-side. It also keeps the client free of
third-party endpoints.

### Sessions are opaque tokens in the database, not JWTs

**Decision.** A 256-bit random token in an `HttpOnly; SameSite=Lax; Secure`
cookie. Only its SHA-256 is stored.

**Reasoning.** Revocation must be immediate and total — "log out everywhere",
and forced logout on password change or reset. JWTs cannot do that without a
denylist, which reintroduces the database read a JWT was meant to avoid. Storing
only the digest means a database leak hands out no live sessions.

**Cost.** One indexed lookup per authenticated request, plus a write to extend
expiry — throttled to at most once per hour per session (sliding expiry).

### Handlers depend on a `Store` interface

**Reasoning.** Keeps Postgres out of the HTTP layer and lets the persistence
layer be faked or swapped without touching handlers.

### The 8-colour cap is server-side

**Decision.** `POST /profiles/{id}/colors` is a sub-resource that dedupes,
prepends, and evicts past eight, backed by a database `CHECK` constraint.

**Reasoning.** Modelling it as a field on `PATCH` would push the eviction rule
into every client. As a sub-resource the rule exists once.

### One image serves both halves

**Decision.** The Dockerfile builds the SPA in a Node stage, the binary in a Go
stage, and copies both into an Alpine runtime. `STATIC_DIR` points the Go server
at the bundle.

**Reasoning.** The deployment standard calls for a single service behind Traefik
with one internal port. Serving both from one origin also removes cross-site
cookie handling entirely in production.

**Trade-off.** The frontend cannot be redeployed independently of the API. For a
project of this size that is a simplification, not a constraint.

### The database is on a private bridge, not the Traefik network

**Decision.** `docker-compose.yml` declares two networks: the external `traefik`
network Traefik owns, and `life-tracker-internal`, an explicit bridge. The app
joins both; Postgres joins only the bridge. Neither container publishes a port.

**Reasoning.** Traefik discovers everything on its network. Putting Postgres
there would make the database routable by a proxy whose whole job is exposing
things to the internet. A separate bridge keeps the database reachable by exactly
one peer, by container name (`life-tracker-db:5432`), with no host port.

**Development exception.** `docker-compose.dev.yml` is an overlay — not a second
deployment — that adds a `127.0.0.1:5433:5432` binding so a host-run `make api`
can reach the database. Bound to loopback, and never applied in production.

## Data flow: changing a seat colour on a saved profile

1. User drags a slider → `setSeatColor` updates the seat locally; the seat
   repaints on every frame.
2. Pointer release → `onCommit` fires once.
3. `updateProfile(id, {color})` persists the colour on the profile.
4. `rememberColor(id, hex)` pushes it into the swatch history; the server
   dedupes and evicts past eight and returns the updated profile.
5. Both responses replace the profile in `remote.profiles`.

An anonymous user completes step 1 only. That is the whole difference.

## Dependencies

Backend: `go-chi/chi/v5`, `jackc/pgx/v5`, `google/uuid`, `golang.org/x/crypto`.
No ORM, no migration tool — migrations are an embedded `fs.FS` walked in lexical
order and recorded in `schema_migrations`, one transaction per file.

Frontend: `react`, `react-dom`, `zustand`. No UI kit, no CSS framework, no data
fetching library; styling is one hand-written stylesheet driven by custom
properties.
