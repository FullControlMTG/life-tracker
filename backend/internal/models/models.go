// Package models holds the domain types shared by the store and the HTTP API.
package models

import (
	"time"

	"github.com/google/uuid"
)

// MaxSavedColors is the per-profile cap on the saved swatch list. Pushing a
// ninth color evicts the oldest.
const MaxSavedColors = 8

type User struct {
	ID           uuid.UUID `json:"id"`
	Email        string    `json:"email"`
	DisplayName  string    `json:"displayName"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type Session struct {
	ID         uuid.UUID `json:"id"`
	UserID     uuid.UUID `json:"-"`
	UserAgent  string    `json:"userAgent"`
	IP         string    `json:"ip"`
	CreatedAt  time.Time `json:"createdAt"`
	LastSeenAt time.Time `json:"lastSeenAt"`
	ExpiresAt  time.Time `json:"expiresAt"`
	Current    bool      `json:"current"`
}

type Settings struct {
	DefaultPlayerCount  int       `json:"defaultPlayerCount"`
	DefaultStartingLife int       `json:"defaultStartingLife"`
	DefaultLayoutID     string    `json:"defaultLayoutId"`
	Theme               string    `json:"theme"`
	HapticsEnabled      bool      `json:"hapticsEnabled"`
	UpdatedAt           time.Time `json:"updatedAt"`
}

// DefaultSettings is what an account gets before it has ever saved settings.
func DefaultSettings() Settings {
	return Settings{
		DefaultPlayerCount:  4,
		DefaultStartingLife: 40,
		DefaultLayoutID:     "",
		Theme:               "dark",
		HapticsEnabled:      true,
	}
}

// CardBackground is a Scryfall image referenced by URL plus a focal point. We
// never re-encode or resize the art: the client crops with object-fit/cover and
// object-position, so the image is cropped, never distorted.
type CardBackground struct {
	ScryfallID string  `json:"scryfallId"`
	Name       string  `json:"name"`
	ImageURI   string  `json:"imageUri"`
	FocusX     float64 `json:"focusX"`
	FocusY     float64 `json:"focusY"`
}

type Profile struct {
	ID          uuid.UUID `json:"id"`
	DisplayName string    `json:"displayName"`
	Color       string    `json:"color"`
	Background  string    `json:"background"` // "color" | "image"
	// Symbol is the icon this player plays under. Empty means no preference.
	Symbol      string          `json:"symbol"`
	Card        *CardBackground `json:"card"`
	SavedColors []string        `json:"savedColors"`
	CreatedAt   time.Time       `json:"createdAt"`
	UpdatedAt   time.Time       `json:"updatedAt"`
}

// ProfilePatch carries a partial update. A nil field means "leave alone".
type ProfilePatch struct {
	DisplayName *string         `json:"displayName"`
	Color       *string         `json:"color"`
	Background  *string         `json:"background"`
	Symbol      *string         `json:"symbol"`
	Card        *CardBackground `json:"card"`
	ClearCard   bool            `json:"clearCard"`
}
