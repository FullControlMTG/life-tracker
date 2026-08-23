# life-tracker

## Purpose

A web-based life tracker for card games, built for Magic: The Gathering first.
The tracker works with no account: a user picks a player count, a starting life
total and a seating layout, then plays. Signing in adds saved player profiles —
name, colour, an eight-slot colour history, and Scryfall card artwork — that can
be loaded into any seat. The frontend holds all game state; the backend exists
only to persist per-user profiles and settings.

## Tech stack

| Layer | Choice |
|---|---|
| Backend | Go 1.26, `go-chi/chi` v5 router, `jackc/pgx` v5 |
| Database | PostgreSQL 17 |
| Auth | argon2id password hashing, opaque session tokens in an HttpOnly cookie |
| Frontend | React 19, TypeScript, Vite 8, Zustand 5 |
| Frontend tests | Vitest |
| Lint | `go vet`; `oxlint` |
| Deploy | Docker multi-stage image behind Traefik; Jenkins declarative pipeline |

Package managers: `go mod` (backend), `npm` (frontend).

## Directory layout

| Path | Contents |
|---|---|
| `backend/cmd/server/` | Entrypoint: connect, migrate, serve, graceful shutdown |
| `backend/internal/auth/` | argon2id hashing and opaque session/reset tokens |
| `backend/internal/config/` | Environment-variable configuration |
| `backend/internal/httpapi/` | Router, middleware, handlers, validation, static SPA serving |
| `backend/internal/migrations/` | Embedded SQL schema, applied on boot |
| `backend/internal/models/` | Domain types shared by store and API |
| `backend/internal/scryfall/` | Cached, rate-limited Scryfall client |
| `backend/internal/store/` | `Store` interface plus the Postgres implementation |
| `frontend/src/api/` | Typed HTTP client and wire types |
| `frontend/src/components/` | Seat, split layout, colour picker, card search, menus |
| `frontend/src/game/` | Layout trees, colour maths, icon data |
| `frontend/src/screens/` | Three setup steps and the game board |
| `frontend/src/state/` | The single Zustand state object |
| `.claude/` | These knowledge files |

## Commands

```bash
make install     # go mod download + npm install
make db          # Postgres 17 in Docker on :5433 (docker-compose.dev.yml)
make api         # Go API on :8080; applies migrations on boot
make web         # Vite dev server on :5173, proxying /api to :8080
make test        # go test ./... and vitest run
make build       # backend/bin/server and frontend/dist
make fmt         # go fmt + go vet
make image       # build the production Docker image
make deploy      # build and start the Traefik stack
make deploy-down # stop the stack, keeping the database volume
```

Frontend-only: `npm run lint` (oxlint), `npx tsc --noEmit` (type-check).

## Conventions an agent must follow

- **Never put a user id in a URL path.** Every authenticated route is scoped
  implicitly to the session's user. Breaking this breaks the access model.
- **The layout invariant is load-bearing.** Every seat rectangle must touch an
  outer edge of the screen. `frontend/src/game/layout.test.ts` enforces it; a new
  preset that violates it will fail the suite. See [DESIGN.md](DESIGN.md).
- **Profile image URIs must stay restricted to Scryfall hosts.** The value is
  rendered into an `<img src>`; the allowlist in
  `backend/internal/httpapi/validate.go` is a security control, not a nicety.
- **The saved-colour cap lives on the server**, in `pushColor` and in a database
  `CHECK` constraint. Do not reimplement eviction client-side.
- Backend errors always return the single `APIError` shape
  (`{code, message, fields?}`). Add new failures through `writeError`.
- Go code is `gofmt`-formatted and must pass `go vet`.
- Do not add comments to `Dockerfile`, `docker-compose.yml` or `Jenkinsfile`
  beyond short one-liners for genuinely non-obvious logic; this is a
  deployment-standard requirement.
- Migrations are append-only files in `backend/internal/migrations/`, applied in
  lexical filename order and recorded in `schema_migrations`. Never edit an
  applied migration; add a new one.
- TODO: commit message and branch naming conventions are not established — the
  repository has a single commit and no CONTRIBUTING file.

## Further reading

- [GOALS.md](GOALS.md) — scope, priorities, non-goals
- [DESIGN.md](DESIGN.md) — architecture and design decisions
- [IMPLEMENTATION.md](IMPLEMENTATION.md) — history, limitations, tech debt
- [GLOSSARY.md](GLOSSARY.md) — domain terms
