// Package store defines persistence for the API. Handlers depend on the Store
// interface only, so the Postgres implementation can be swapped or faked.
package store

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/fullcontrolmtg/life-tracker/backend/internal/models"
)

var (
	ErrNotFound = errors.New("store: not found")
	ErrConflict = errors.New("store: conflict")
)

type SessionRecord struct {
	ID         uuid.UUID
	UserID     uuid.UUID
	UserAgent  string
	IP         string
	CreatedAt  time.Time
	LastSeenAt time.Time
	ExpiresAt  time.Time
}

type Store interface {
	// Users
	CreateUser(ctx context.Context, email, passwordHash, displayName string) (*models.User, error)
	UserByEmail(ctx context.Context, email string) (*models.User, error)
	UserByID(ctx context.Context, id uuid.UUID) (*models.User, error)
	SetUserPassword(ctx context.Context, id uuid.UUID, passwordHash string) error

	// Sessions
	CreateSession(ctx context.Context, userID uuid.UUID, tokenHash []byte, userAgent, ip string, expiresAt time.Time) (*SessionRecord, error)
	SessionByTokenHash(ctx context.Context, tokenHash []byte) (*SessionRecord, error)
	TouchSession(ctx context.Context, id uuid.UUID, expiresAt time.Time) error
	DeleteSession(ctx context.Context, id uuid.UUID) error
	DeleteUserSessions(ctx context.Context, userID uuid.UUID, except uuid.UUID) error
	ListSessions(ctx context.Context, userID uuid.UUID) ([]SessionRecord, error)
	DeleteExpiredSessions(ctx context.Context) (int64, error)

	// Password resets
	CreatePasswordReset(ctx context.Context, userID uuid.UUID, tokenHash []byte, expiresAt time.Time) error
	ConsumePasswordReset(ctx context.Context, tokenHash []byte) (uuid.UUID, error)

	// Settings
	Settings(ctx context.Context, userID uuid.UUID) (models.Settings, error)
	SaveSettings(ctx context.Context, userID uuid.UUID, s models.Settings) (models.Settings, error)

	// Profiles
	ListProfiles(ctx context.Context, userID uuid.UUID) ([]models.Profile, error)
	CreateProfile(ctx context.Context, userID uuid.UUID, p models.Profile) (*models.Profile, error)
	Profile(ctx context.Context, userID, id uuid.UUID) (*models.Profile, error)
	UpdateProfile(ctx context.Context, userID, id uuid.UUID, patch models.ProfilePatch) (*models.Profile, error)
	DeleteProfile(ctx context.Context, userID, id uuid.UUID) error
	SetProfileColors(ctx context.Context, userID, id uuid.UUID, colors []string) (*models.Profile, error)
}
