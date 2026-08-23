package httpapi

import (
	"context"
	"errors"
	"net/http"
	"slices"
	"time"

	"github.com/fullcontrolmtg/life-tracker/backend/internal/auth"
	"github.com/fullcontrolmtg/life-tracker/backend/internal/models"
	"github.com/fullcontrolmtg/life-tracker/backend/internal/store"
)

type ctxKey int

const (
	ctxUser ctxKey = iota
	ctxSessionID
)

// withSession resolves the session cookie, if present, and stashes the user on
// the request context. It never rejects: anonymous requests flow through so
// public endpoints keep working.
func (s *Server) withSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(s.cfg.CookieName)
		if err != nil || cookie.Value == "" {
			next.ServeHTTP(w, r)
			return
		}

		rec, err := s.store.SessionByTokenHash(r.Context(), auth.HashToken(cookie.Value))
		if err != nil {
			if errors.Is(err, store.ErrNotFound) {
				s.clearSessionCookie(w)
				next.ServeHTTP(w, r)
				return
			}
			writeError(w, r, err)
			return
		}

		user, err := s.store.UserByID(r.Context(), rec.UserID)
		if err != nil {
			if errors.Is(err, store.ErrNotFound) {
				s.clearSessionCookie(w)
				next.ServeHTTP(w, r)
				return
			}
			writeError(w, r, err)
			return
		}

		// Sliding expiry: refresh at most once an hour to avoid a write per request.
		if time.Since(rec.LastSeenAt) > time.Hour {
			expires := time.Now().Add(s.cfg.SessionTTL)
			if err := s.store.TouchSession(r.Context(), rec.ID, expires); err == nil {
				s.setSessionCookie(w, cookie.Value, expires)
			}
		}

		ctx := context.WithValue(r.Context(), ctxUser, user)
		ctx = context.WithValue(ctx, ctxSessionID, rec.ID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// requireSession gates the authenticated half of the API.
func requireSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := r.Context().Value(ctxUser).(*models.User); !ok {
			writeError(w, r, errUnauthorized("you must be signed in"))
			return
		}
		next.ServeHTTP(w, r)
	})
}

func userFrom(ctx context.Context) *models.User {
	u, _ := ctx.Value(ctxUser).(*models.User)
	return u
}

// cors allows the SPA origin with credentials. Origins are an explicit
// allowlist; credentialed CORS cannot use a wildcard.
func cors(allowed []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" && slices.Contains(allowed, origin) {
				h := w.Header()
				h.Set("Access-Control-Allow-Origin", origin)
				h.Set("Access-Control-Allow-Credentials", "true")
				h.Set("Vary", "Origin")
				if r.Method == http.MethodOptions {
					h.Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
					h.Set("Access-Control-Allow-Headers", "Content-Type")
					h.Set("Access-Control-Max-Age", "600")
					w.WriteHeader(http.StatusNoContent)
					return
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}
