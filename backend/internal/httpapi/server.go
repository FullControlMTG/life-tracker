package httpapi

import (
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/fullcontrolmtg/life-tracker/backend/internal/config"
	"github.com/fullcontrolmtg/life-tracker/backend/internal/scryfall"
	"github.com/fullcontrolmtg/life-tracker/backend/internal/store"
)

type Server struct {
	cfg      config.Config
	store    store.Store
	scryfall *scryfall.Client
	limiter  *rateLimiter
}

func New(cfg config.Config, st store.Store, sf *scryfall.Client) *Server {
	return &Server{cfg: cfg, store: st, scryfall: sf, limiter: newRateLimiter()}
}

// Routes returns the full API surface. Everything below /api/v1 that is not
// under /auth or /cards requires a session and is implicitly scoped to the
// session's user id — a user id never appears in a path.
func (s *Server) Routes() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(20 * time.Second))
	r.Use(cors(s.cfg.CORSOrigins))

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Route("/api/v1", func(r chi.Router) {
		r.Use(s.withSession)

		r.Route("/auth", func(r chi.Router) {
			// Credential endpoints are rate limited per IP to blunt brute force.
			r.Group(func(r chi.Router) {
				r.Use(s.rateLimit(10, time.Minute))
				r.Post("/register", s.handleRegister)
				r.Post("/login", s.handleLogin)
				r.Post("/password/forgot", s.handleForgotPassword)
				r.Post("/password/reset", s.handleResetPassword)
			})
			r.Post("/logout", s.handleLogout)
			r.Get("/me", s.handleMe)

			r.Group(func(r chi.Router) {
				r.Use(requireSession)
				r.Post("/password/change", s.handleChangePassword)
				r.Get("/sessions", s.handleListSessions)
				r.Delete("/sessions", s.handleRevokeOtherSessions)
			})
		})

		r.With(requireSession).Get("/bootstrap", s.handleBootstrap)

		r.Route("/settings", func(r chi.Router) {
			r.Use(requireSession)
			r.Get("/", s.handleGetSettings)
			r.Put("/", s.handlePutSettings)
		})

		r.Route("/profiles", func(r chi.Router) {
			r.Use(requireSession)
			r.Get("/", s.handleListProfiles)
			r.Post("/", s.handleCreateProfile)
			r.Route("/{profileID}", func(r chi.Router) {
				r.Get("/", s.handleGetProfile)
				r.Patch("/", s.handlePatchProfile)
				r.Delete("/", s.handleDeleteProfile)
				r.Post("/colors", s.handlePushColor)
				r.Delete("/colors/{hex}", s.handleDeleteColor)
			})
		})

		// Card search is open to anonymous users: the tracker itself needs no
		// account, and the proxy exists to cache and rate-limit Scryfall.
		r.Route("/cards", func(r chi.Router) {
			r.Use(s.rateLimit(60, time.Minute))
			r.Get("/autocomplete", s.handleCardAutocomplete)
			r.Get("/search", s.handleCardSearch)
		})
	})

	// In production the same binary serves the built SPA; unmatched API paths
	// still get a JSON 404 rather than the index page.
	var static http.Handler
	if s.cfg.StaticDir != "" {
		static = newStaticHandler(s.cfg.StaticDir)
	}
	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		if static == nil || strings.HasPrefix(r.URL.Path, "/api/") {
			writeError(w, r, errNotFound("no such endpoint"))
			return
		}
		static.ServeHTTP(w, r)
	})
	return r
}
