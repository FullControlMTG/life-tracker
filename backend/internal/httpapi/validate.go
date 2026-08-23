package httpapi

import (
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/fullcontrolmtg/life-tracker/backend/internal/models"
)

var (
	emailRe = regexp.MustCompile(`^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$`)
	hexRe   = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
)

const (
	minPasswordLen  = 10
	maxPasswordLen  = 200
	maxDisplayName  = 40
	maxEmailLen     = 254
	maxCardNameLen  = 200
	maxImageURILen  = 500
	maxLayoutIDLen  = 64
	maxScryfallIDLn = 64
)

// fieldErrors accumulates per-field validation failures so the client can show
// them inline instead of one opaque message.
type fieldErrors map[string]string

func (f fieldErrors) add(field, msg string) {
	if _, exists := f[field]; !exists {
		f[field] = msg
	}
}

func (f fieldErrors) err(msg string) *APIError {
	if len(f) == 0 {
		return nil
	}
	return errBadRequest(msg, f)
}

func validateEmail(f fieldErrors, email string) string {
	email = strings.TrimSpace(email)
	switch {
	case email == "":
		f.add("email", "email is required")
	case len(email) > maxEmailLen:
		f.add("email", "email is too long")
	case !emailRe.MatchString(email):
		f.add("email", "that does not look like an email address")
	}
	return email
}

func validatePassword(f fieldErrors, field, password string) {
	switch {
	case password == "":
		f.add(field, "password is required")
	case utf8.RuneCountInString(password) < minPasswordLen:
		f.add(field, "password must be at least 10 characters")
	case len(password) > maxPasswordLen:
		f.add(field, "password is too long")
	}
}

func validateDisplayName(f fieldErrors, field, name string) string {
	name = strings.TrimSpace(name)
	switch {
	case name == "":
		f.add(field, "a name is required")
	case utf8.RuneCountInString(name) > maxDisplayName:
		f.add(field, "name must be 40 characters or fewer")
	}
	return name
}

// normalizeHex lowercases and validates a #rrggbb color.
func normalizeHex(f fieldErrors, field, hex string) string {
	hex = strings.TrimSpace(hex)
	if hex == "" {
		return ""
	}
	if !hexRe.MatchString(hex) {
		f.add(field, "color must be a hex value like #3b82f6")
		return ""
	}
	return strings.ToLower(hex)
}

func validateCard(f fieldErrors, card *models.CardBackground) *models.CardBackground {
	if card == nil {
		return nil
	}
	out := *card
	out.ScryfallID = strings.TrimSpace(out.ScryfallID)
	out.Name = strings.TrimSpace(out.Name)
	out.ImageURI = strings.TrimSpace(out.ImageURI)

	if len(out.ScryfallID) > maxScryfallIDLn {
		f.add("card.scryfallId", "id is too long")
	}
	if utf8.RuneCountInString(out.Name) > maxCardNameLen {
		f.add("card.name", "name is too long")
	}
	if out.ImageURI == "" {
		f.add("card.imageUri", "an image URI is required")
	} else if len(out.ImageURI) > maxImageURILen {
		f.add("card.imageUri", "image URI is too long")
	} else if !isScryfallImageURI(out.ImageURI) {
		// Only Scryfall's CDN is allowed: the value ends up in an <img src>, so
		// accepting arbitrary URLs would turn profiles into an SSRF/tracking vector.
		f.add("card.imageUri", "image must be hosted on scryfall.io")
	}

	out.FocusX = clamp01(out.FocusX)
	out.FocusY = clamp01(out.FocusY)
	return &out
}

func isScryfallImageURI(uri string) bool {
	return strings.HasPrefix(uri, "https://cards.scryfall.io/") ||
		strings.HasPrefix(uri, "https://svgs.scryfall.io/")
}

func clamp01(v float64) float64 {
	if v < 0 {
		return 0
	}
	if v > 1 {
		return 1
	}
	return v
}

// pushColor prepends hex to colors, removes any duplicate, and trims the list
// to models.MaxSavedColors by dropping the oldest entries.
func pushColor(colors []string, hex string) []string {
	out := make([]string, 0, len(colors)+1)
	out = append(out, hex)
	for _, c := range colors {
		if !strings.EqualFold(c, hex) {
			out = append(out, c)
		}
	}
	if len(out) > models.MaxSavedColors {
		out = out[:models.MaxSavedColors]
	}
	return out
}

func removeColor(colors []string, hex string) []string {
	out := make([]string, 0, len(colors))
	for _, c := range colors {
		if !strings.EqualFold(c, hex) {
			out = append(out, c)
		}
	}
	return out
}
