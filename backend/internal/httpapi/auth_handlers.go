package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/fullcontrolmtg/life-tracker/backend/internal/auth"
	"github.com/fullcontrolmtg/life-tracker/backend/internal/models"
	"github.com/fullcontrolmtg/life-tracker/backend/internal/store"
)

// dummyHash is verified against when no user matches, so a login attempt costs
// the same whether or not the email exists.
var dummyHash, _ = auth.HashPassword("this-password-is-never-correct")

func (s *Server) setSessionCookie(w http.ResponseWriter, token string, expires time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     s.cfg.CookieName,
		Value:    token,
		Path:     "/",
		Domain:   s.cfg.CookieDomain,
		Expires:  expires,
		MaxAge:   int(time.Until(expires).Seconds()),
		HttpOnly: true,
		Secure:   s.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

func (s *Server) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     s.cfg.CookieName,
		Value:    "",
		Path:     "/",
		Domain:   s.cfg.CookieDomain,
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   s.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

// startSession mints a token, persists its digest, and sets the cookie.
func (s *Server) startSession(w http.ResponseWriter, r *http.Request, userID uuid.UUID) error {
	token, digest, err := auth.NewToken()
	if err != nil {
		return err
	}
	expires := time.Now().Add(s.cfg.SessionTTL)
	if _, err := s.store.CreateSession(r.Context(), userID, digest, r.UserAgent(), clientIP(r), expires); err != nil {
		return err
	}
	s.setSessionCookie(w, token, expires)
	return nil
}

type credentials struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"displayName"`
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var in credentials
	if err := decodeJSON(w, r, &in); err != nil {
		writeError(w, r, err)
		return
	}

	f := fieldErrors{}
	email := validateEmail(f, in.Email)
	validatePassword(f, "password", in.Password)
	name := validateDisplayName(f, "displayName", in.DisplayName)
	if err := f.err("check the highlighted fields"); err != nil {
		writeError(w, r, err)
		return
	}

	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		writeError(w, r, err)
		return
	}

	user, err := s.store.CreateUser(r.Context(), email, hash, name)
	if err != nil {
		if errors.Is(err, store.ErrConflict) {
			writeError(w, r, errConflict("an account with that email already exists"))
			return
		}
		writeError(w, r, err)
		return
	}

	if err := s.startSession(w, r, user.ID); err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"user": user})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var in credentials
	if err := decodeJSON(w, r, &in); err != nil {
		writeError(w, r, err)
		return
	}

	invalid := errUnauthorized("email or password is incorrect")

	user, err := s.store.UserByEmail(r.Context(), in.Email)
	if err != nil && !errors.Is(err, store.ErrNotFound) {
		writeError(w, r, err)
		return
	}

	hash := dummyHash
	if user != nil {
		hash = user.PasswordHash
	}
	ok, verifyErr := auth.VerifyPassword(in.Password, hash)
	if verifyErr != nil {
		slog.Error("verify password", "err", verifyErr)
	}
	if user == nil || !ok {
		writeError(w, r, invalid)
		return
	}

	if err := s.startSession(w, r, user.ID); err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if id, ok := r.Context().Value(ctxSessionID).(uuid.UUID); ok {
		if err := s.store.DeleteSession(r.Context(), id); err != nil {
			writeError(w, r, err)
			return
		}
	}
	s.clearSessionCookie(w)
	writeJSON(w, http.StatusNoContent, nil)
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	user := userFrom(r.Context())
	if user == nil {
		writeError(w, r, errUnauthorized("not signed in"))
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (s *Server) handleChangePassword(w http.ResponseWriter, r *http.Request) {
	var in struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if err := decodeJSON(w, r, &in); err != nil {
		writeError(w, r, err)
		return
	}

	f := fieldErrors{}
	validatePassword(f, "newPassword", in.NewPassword)
	if err := f.err("check the highlighted fields"); err != nil {
		writeError(w, r, err)
		return
	}

	user := userFrom(r.Context())
	ok, err := auth.VerifyPassword(in.CurrentPassword, user.PasswordHash)
	if err != nil {
		writeError(w, r, err)
		return
	}
	if !ok {
		writeError(w, r, errBadRequest("check the highlighted fields",
			map[string]string{"currentPassword": "that is not your current password"}))
		return
	}

	hash, err := auth.HashPassword(in.NewPassword)
	if err != nil {
		writeError(w, r, err)
		return
	}
	if err := s.store.SetUserPassword(r.Context(), user.ID, hash); err != nil {
		writeError(w, r, err)
		return
	}

	// A password change logs out every other device.
	currentSession, _ := r.Context().Value(ctxSessionID).(uuid.UUID)
	if err := s.store.DeleteUserSessions(r.Context(), user.ID, currentSession); err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (s *Server) handleForgotPassword(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email string `json:"email"`
	}
	if err := decodeJSON(w, r, &in); err != nil {
		writeError(w, r, err)
		return
	}

	// Always 204 regardless of outcome so this cannot enumerate accounts.
	defer writeJSON(w, http.StatusNoContent, nil)

	user, err := s.store.UserByEmail(r.Context(), in.Email)
	if err != nil {
		return
	}
	token, digest, err := auth.NewToken()
	if err != nil {
		slog.Error("mint reset token", "err", err)
		return
	}
	if err := s.store.CreatePasswordReset(r.Context(), user.ID, digest, time.Now().Add(s.cfg.ResetTTL)); err != nil {
		slog.Error("store reset token", "err", err)
		return
	}

	// No mail transport is wired up yet. Logging the link keeps the flow
	// testable end to end; swap this for an email send when SMTP exists.
	slog.Info("password reset requested", "email", user.Email, "token", token, "ttl", s.cfg.ResetTTL)
}

func (s *Server) handleResetPassword(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Token       string `json:"token"`
		NewPassword string `json:"newPassword"`
	}
	if err := decodeJSON(w, r, &in); err != nil {
		writeError(w, r, err)
		return
	}

	f := fieldErrors{}
	validatePassword(f, "newPassword", in.NewPassword)
	if in.Token == "" {
		f.add("token", "reset token is required")
	}
	if err := f.err("check the highlighted fields"); err != nil {
		writeError(w, r, err)
		return
	}

	userID, err := s.store.ConsumePasswordReset(r.Context(), auth.HashToken(in.Token))
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, r, errBadRequest("that reset link is invalid or has expired", nil))
			return
		}
		writeError(w, r, err)
		return
	}

	hash, err := auth.HashPassword(in.NewPassword)
	if err != nil {
		writeError(w, r, err)
		return
	}
	if err := s.store.SetUserPassword(r.Context(), userID, hash); err != nil {
		writeError(w, r, err)
		return
	}
	// Resetting a password invalidates every existing session.
	if err := s.store.DeleteUserSessions(r.Context(), userID, uuid.Nil); err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (s *Server) handleListSessions(w http.ResponseWriter, r *http.Request) {
	user := userFrom(r.Context())
	current, _ := r.Context().Value(ctxSessionID).(uuid.UUID)

	records, err := s.store.ListSessions(r.Context(), user.ID)
	if err != nil {
		writeError(w, r, err)
		return
	}

	out := make([]models.Session, 0, len(records))
	for _, rec := range records {
		out = append(out, models.Session{
			ID:         rec.ID,
			UserAgent:  rec.UserAgent,
			IP:         rec.IP,
			CreatedAt:  rec.CreatedAt,
			LastSeenAt: rec.LastSeenAt,
			ExpiresAt:  rec.ExpiresAt,
			Current:    rec.ID == current,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"sessions": out})
}

func (s *Server) handleRevokeOtherSessions(w http.ResponseWriter, r *http.Request) {
	user := userFrom(r.Context())
	current, _ := r.Context().Value(ctxSessionID).(uuid.UUID)
	if err := s.store.DeleteUserSessions(r.Context(), user.ID, current); err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}
