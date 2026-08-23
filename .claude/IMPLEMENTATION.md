# Implementation history

## Caveat on sources

Git history carries almost no signal: the repository has a **single commit**
(`ddb9d0a`, "Initial commit") containing only `README.md`, on branch `main`. The
entire application is currently uncommitted working-tree state. The history below
is reconstructed from the code itself, not from commits.

TODO: once the application is committed, replace this section with a real
milestone list derived from git history.

## Milestones

### 1. Backend foundation

Go module `github.com/fullcontrolmtg/life-tracker/backend`. Chi router, pgx
connection pool with boot-time retry, a hand-rolled migration runner over an
embedded `fs.FS`, and graceful shutdown. A `Store` interface with a Postgres
implementation. One migration, `0001_init.sql`: `users`, `sessions`,
`password_resets`, `user_settings`, `profiles`.

### 2. Authentication

argon2id hashing (64 MiB, 2 passes, 4 lanes) in a self-describing PHC string.
Opaque 256-bit session tokens stored as SHA-256 digests. Register, login, logout,
`me`, password change, forgot, reset, session listing, and bulk revocation.
Login verifies against a dummy hash when no user matches, so timing does not
disclose account existence. Per-IP fixed-window rate limiting on credential
endpoints.

### 3. Profiles, settings, Scryfall

Per-user profile CRUD with a saved-colour sub-resource capping the list at eight.
A `/bootstrap` endpoint returning user, settings and profiles in one call. A
cached, rate-limited Scryfall client behind `/cards/search` and
`/cards/autocomplete`.

### 4. Frontend

Vite + React 19 + TypeScript. The layout split-tree module, the Zustand store,
three setup screens, the game board, and the seat components — colour picker,
card search, counters, account menu. Styling is a single stylesheet.

### 5. Browser-driven verification and fixes

The app was driven end to end with Playwright. Two defects were found and fixed:

- **Seat menu clipped in short seats.** The sheet rendered inside the seat
  rectangle; on a four-player layout the end seats are roughly 230px tall and the
  colour picker was cut off. Fixed by portaling the sheet to a full-screen
  overlay that retains the seat's rotation and sizes in `vmin`.
- **Orientation thumbnails overflowed their cells.** The preview rotated whole
  seat rectangles, so a wide cell rotated a quarter turn spilled outside its
  bounds. Fixed by rotating only the label inside each rectangle. The glyph is a
  downward triangle in the seat's own frame, so after rotation it always points
  at the edge that player sits at.

### 6. Lint cleanup and module split

Resolved oxlint findings: the latest-callback ref in `useHold` moved into an
effect; `CardSearch` stopped resetting state inside an effect in favour of
derived values. `game/icons.tsx` was split into `game/icons.ts` (data) and
`components/Icon.tsx` (component) so fast refresh works cleanly.

### 7. Deployment standard (Docker, Traefik, Jenkins)

Applied the `pws-prompt-engineering/infrastructure` Definition of Done.

- **Same-origin migration.** The API client base changed from an absolute
  `http://localhost:8080/api/v1` to a relative `/api/v1`, and the Vite dev server
  gained an `/api` proxy. Development and production now behave identically and
  CORS is not exercised in either.
- **Static serving.** `httpapi/static.go` serves the built SPA with an
  `index.html` fallback, immutable caching for fingerprinted assets, and a
  path-traversal guard. Paths under `/api/` still return JSON 404s. Enabled by
  `STATIC_DIR`; empty in development.
- **Dockerfile.** Three stages — Node build, Go build, Alpine runtime. Runs as
  uid 10001, exposes 8080, `HEALTHCHECK` probes `/healthz`. Verified image size
  36.6 MB.
- **Compose.** The former root `docker-compose.yml` (dev Postgres) became
  `docker-compose.dev.yml`, reduced to a development overlay that adds a loopback
  port binding to the database. The root file now defines the entire deployment:
  the app on the external `traefik` network plus the `life-tracker-internal`
  bridge, and Postgres on that bridge alone with no published ports.
- **Jenkinsfile.** Seven stages plus Discord notification and failure
  diagnostics. Deploys to `tracker.fullcontrolmtg.com`.

## Current limitations and tech debt

| Area | Status |
|---|---|
| Password reset email | Not wired. `POST /auth/password/forgot` logs the token via `slog` instead of sending mail. The flow is complete and testable; one call needs replacing with an SMTP send. |
| Rate limiter | In-memory and process-local. Correct for a single node; needs a shared store before running more than one replica. |
| Secrets at deploy time | `POSTGRES_PASSWORD` comes from a gitignored `.env` beside the compose file, or from the Jenkins credential in CI. There is no secrets manager; rotating the password means editing `.env` and recreating the database container. |
| Git history | The application is uncommitted. Everything above `ddb9d0a` exists only in the working tree. |
| Test coverage | Backend tests cover `auth` and `httpapi` validation only — no handler or store integration tests, and no test double for `Store`. Frontend tests cover `game/layout` and `game/color` only; no component tests. |
| End-to-end tests | The Playwright driver used during development was deliberately not committed, to avoid a ~100 MB browser dependency. There is no committed e2e suite. |
| Theme setting | `settings.theme` is persisted and validated but the frontend does not read it. The UI is dark-only. |
| `settings.hapticsEnabled` | Persisted but unused; no haptics are triggered. |
| Session cookie domain | Production sets `SESSION_COOKIE_DOMAIN` to the app domain. Revisit if the app is ever served from more than one host. |
| Accessibility | Seats and controls carry ARIA labels, but rotated text has not been checked with a screen reader, and there is no keyboard path to change life totals other than the sliders' arrow keys. |

## Areas under active change

The deployment configuration is the most recently added surface and the least
exercised — the Jenkins pipeline has been syntax-validated (Groovy parse, POSIX
`sh -n` on every script block) and the image has been built and smoke-tested
locally, but the pipeline has not yet run on the Jenkins instance.
