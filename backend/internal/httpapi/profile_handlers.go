package httpapi

import (
	"net/http"
	"net/url"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/fullcontrolmtg/life-tracker/backend/internal/models"
)

// handleBootstrap is the single call the SPA makes on load when a session
// cookie is present. It returns everything the optional `remote` branch of the
// frontend state object needs, avoiding a three-request waterfall.
func (s *Server) handleBootstrap(w http.ResponseWriter, r *http.Request) {
	user := userFrom(r.Context())

	settings, err := s.store.Settings(r.Context(), user.ID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	profiles, err := s.store.ListProfiles(r.Context(), user.ID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"user":     user,
		"settings": settings,
		"profiles": profiles,
	})
}

func (s *Server) handleGetSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := s.store.Settings(r.Context(), userFrom(r.Context()).ID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"settings": settings})
}

func (s *Server) handlePutSettings(w http.ResponseWriter, r *http.Request) {
	var in models.Settings
	if err := decodeJSON(w, r, &in); err != nil {
		writeError(w, r, err)
		return
	}

	f := fieldErrors{}
	if in.DefaultPlayerCount < 1 || in.DefaultPlayerCount > 6 {
		f.add("defaultPlayerCount", "must be between 1 and 6")
	}
	if in.DefaultStartingLife < 1 || in.DefaultStartingLife > 999 {
		f.add("defaultStartingLife", "must be between 1 and 999")
	}
	if len(in.DefaultLayoutID) > maxLayoutIDLen {
		f.add("defaultLayoutId", "layout id is too long")
	}
	if in.Theme != "dark" && in.Theme != "light" {
		f.add("theme", `must be "dark" or "light"`)
	}
	if err := f.err("check the highlighted fields"); err != nil {
		writeError(w, r, err)
		return
	}

	saved, err := s.store.SaveSettings(r.Context(), userFrom(r.Context()).ID, in)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"settings": saved})
}

func (s *Server) handleListProfiles(w http.ResponseWriter, r *http.Request) {
	profiles, err := s.store.ListProfiles(r.Context(), userFrom(r.Context()).ID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"profiles": profiles})
}

type profileInput struct {
	DisplayName string                 `json:"displayName"`
	Color       string                 `json:"color"`
	Background  string                 `json:"background"`
	Symbol      string                 `json:"symbol"`
	Card        *models.CardBackground `json:"card"`
}

func (s *Server) handleCreateProfile(w http.ResponseWriter, r *http.Request) {
	var in profileInput
	if err := decodeJSON(w, r, &in); err != nil {
		writeError(w, r, err)
		return
	}

	f := fieldErrors{}
	name := validateDisplayName(f, "displayName", in.DisplayName)
	color := normalizeHex(f, "color", in.Color)
	if color == "" && f["color"] == "" {
		color = "#334155"
	}
	background := in.Background
	if background == "" {
		background = "color"
	}
	if background != "color" && background != "image" {
		f.add("background", `must be "color" or "image"`)
	}
	symbol := normalizeSymbol(f, "symbol", in.Symbol)
	card := validateCard(f, in.Card)
	if background == "image" && card == nil {
		f.add("card", "an image background needs a card")
	}
	if err := f.err("check the highlighted fields"); err != nil {
		writeError(w, r, err)
		return
	}

	created, err := s.store.CreateProfile(r.Context(), userFrom(r.Context()).ID, models.Profile{
		DisplayName: name,
		Color:       color,
		Background:  background,
		Symbol:      symbol,
		Card:        card,
		SavedColors: []string{color},
	})
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"profile": created})
}

func profileID(r *http.Request) (uuid.UUID, error) {
	id, err := uuid.Parse(chi.URLParam(r, "profileID"))
	if err != nil {
		return uuid.Nil, errNotFound("no such profile")
	}
	return id, nil
}

func (s *Server) handleGetProfile(w http.ResponseWriter, r *http.Request) {
	id, err := profileID(r)
	if err != nil {
		writeError(w, r, err)
		return
	}
	profile, err := s.store.Profile(r.Context(), userFrom(r.Context()).ID, id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"profile": profile})
}

func (s *Server) handlePatchProfile(w http.ResponseWriter, r *http.Request) {
	id, err := profileID(r)
	if err != nil {
		writeError(w, r, err)
		return
	}

	// clearCard is an explicit flag because a null `card` is indistinguishable
	// from an omitted one after JSON decoding.
	var in struct {
		DisplayName *string                `json:"displayName"`
		Color       *string                `json:"color"`
		Background  *string                `json:"background"`
		Symbol      *string                `json:"symbol"`
		Card        *models.CardBackground `json:"card"`
		ClearCard   bool                   `json:"clearCard"`
	}
	if err := decodeJSON(w, r, &in); err != nil {
		writeError(w, r, err)
		return
	}

	f := fieldErrors{}
	patch := models.ProfilePatch{ClearCard: in.ClearCard}
	if in.DisplayName != nil {
		name := validateDisplayName(f, "displayName", *in.DisplayName)
		patch.DisplayName = &name
	}
	if in.Color != nil {
		color := normalizeHex(f, "color", *in.Color)
		if color == "" && f["color"] == "" {
			f.add("color", "color is required")
		}
		patch.Color = &color
	}
	if in.Background != nil {
		if *in.Background != "color" && *in.Background != "image" {
			f.add("background", `must be "color" or "image"`)
		}
		patch.Background = in.Background
	}
	if in.Symbol != nil {
		symbol := normalizeSymbol(f, "symbol", *in.Symbol)
		patch.Symbol = &symbol
	}
	if in.Card != nil {
		patch.Card = validateCard(f, in.Card)
	}
	if err := f.err("check the highlighted fields"); err != nil {
		writeError(w, r, err)
		return
	}

	updated, err := s.store.UpdateProfile(r.Context(), userFrom(r.Context()).ID, id, patch)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"profile": updated})
}

func (s *Server) handleDeleteProfile(w http.ResponseWriter, r *http.Request) {
	id, err := profileID(r)
	if err != nil {
		writeError(w, r, err)
		return
	}
	if err := s.store.DeleteProfile(r.Context(), userFrom(r.Context()).ID, id); err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

// handlePushColor keeps the 8-swatch cap on the server so the eviction rule
// lives in exactly one place.
func (s *Server) handlePushColor(w http.ResponseWriter, r *http.Request) {
	id, err := profileID(r)
	if err != nil {
		writeError(w, r, err)
		return
	}
	var in struct {
		Hex string `json:"hex"`
	}
	if err := decodeJSON(w, r, &in); err != nil {
		writeError(w, r, err)
		return
	}

	f := fieldErrors{}
	hex := normalizeHex(f, "hex", in.Hex)
	if hex == "" {
		f.add("hex", "a hex color is required")
	}
	if err := f.err("check the highlighted fields"); err != nil {
		writeError(w, r, err)
		return
	}

	userID := userFrom(r.Context()).ID
	current, err := s.store.Profile(r.Context(), userID, id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	updated, err := s.store.SetProfileColors(r.Context(), userID, id, pushColor(current.SavedColors, hex))
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"profile": updated})
}

func (s *Server) handleDeleteColor(w http.ResponseWriter, r *http.Request) {
	id, err := profileID(r)
	if err != nil {
		writeError(w, r, err)
		return
	}

	// "#3b82f6" arrives percent-encoded as %233b82f6.
	raw, decodeErr := url.PathUnescape(chi.URLParam(r, "hex"))
	if decodeErr != nil {
		writeError(w, r, errBadRequest("malformed color", nil))
		return
	}
	f := fieldErrors{}
	hex := normalizeHex(f, "hex", raw)
	if err := f.err("malformed color"); err != nil {
		writeError(w, r, err)
		return
	}

	userID := userFrom(r.Context()).ID
	current, err := s.store.Profile(r.Context(), userID, id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	updated, err := s.store.SetProfileColors(r.Context(), userID, id, removeColor(current.SavedColors, hex))
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"profile": updated})
}
