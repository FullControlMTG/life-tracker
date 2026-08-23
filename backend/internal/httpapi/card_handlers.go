package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/fullcontrolmtg/life-tracker/backend/internal/scryfall"
)

const maxQueryLen = 100

func cardQuery(r *http.Request) (string, error) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(q) > maxQueryLen {
		return "", errBadRequest("search query is too long", nil)
	}
	return q, nil
}

func (s *Server) handleCardAutocomplete(w http.ResponseWriter, r *http.Request) {
	q, err := cardQuery(r)
	if err != nil {
		writeError(w, r, err)
		return
	}
	names, err := s.scryfall.Autocomplete(r.Context(), q)
	if err != nil {
		writeError(w, r, upstreamError(err))
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"names": names})
}

func (s *Server) handleCardSearch(w http.ResponseWriter, r *http.Request) {
	q, err := cardQuery(r)
	if err != nil {
		writeError(w, r, err)
		return
	}
	cards, err := s.scryfall.Search(r.Context(), q)
	if err != nil {
		writeError(w, r, upstreamError(err))
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"cards": cards})
}

// upstreamError keeps a Scryfall outage from reading as a bug in our API.
func upstreamError(err error) error {
	if errors.Is(err, scryfall.ErrUpstream) {
		return &APIError{
			Status:  http.StatusBadGateway,
			Code:    "upstream_unavailable",
			Message: "card search is unavailable right now",
		}
	}
	return err
}
