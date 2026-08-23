package store

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fullcontrolmtg/life-tracker/backend/internal/models"
)

const uniqueViolation = "23505"

type Postgres struct {
	pool *pgxpool.Pool
}

func NewPostgres(pool *pgxpool.Pool) *Postgres { return &Postgres{pool: pool} }

func translate(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation {
		return ErrConflict
	}
	return err
}

// --- users ---------------------------------------------------------------

const userColumns = `id, email, password_hash, display_name, created_at, updated_at`

func scanUser(row pgx.Row) (*models.User, error) {
	var u models.User
	err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.DisplayName, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, translate(err)
	}
	return &u, nil
}

func (p *Postgres) CreateUser(ctx context.Context, email, passwordHash, displayName string) (*models.User, error) {
	return scanUser(p.pool.QueryRow(ctx,
		`INSERT INTO users (id, email, password_hash, display_name) VALUES ($1, $2, $3, $4) RETURNING `+userColumns,
		uuid.New(), email, passwordHash, displayName))
}

func (p *Postgres) UserByEmail(ctx context.Context, email string) (*models.User, error) {
	return scanUser(p.pool.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE lower(email) = lower($1)`, email))
}

func (p *Postgres) UserByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	return scanUser(p.pool.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE id = $1`, id))
}

func (p *Postgres) SetUserPassword(ctx context.Context, id uuid.UUID, passwordHash string) error {
	tag, err := p.pool.Exec(ctx, `UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, id, passwordHash)
	if err != nil {
		return translate(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// --- sessions ------------------------------------------------------------

const sessionColumns = `id, user_id, user_agent, ip, created_at, last_seen_at, expires_at`

func scanSession(row pgx.Row) (*SessionRecord, error) {
	var s SessionRecord
	err := row.Scan(&s.ID, &s.UserID, &s.UserAgent, &s.IP, &s.CreatedAt, &s.LastSeenAt, &s.ExpiresAt)
	if err != nil {
		return nil, translate(err)
	}
	return &s, nil
}

func (p *Postgres) CreateSession(ctx context.Context, userID uuid.UUID, tokenHash []byte, userAgent, ip string, expiresAt time.Time) (*SessionRecord, error) {
	return scanSession(p.pool.QueryRow(ctx,
		`INSERT INTO sessions (id, user_id, token_hash, user_agent, ip, expires_at)
		 VALUES ($1, $2, $3, $4, $5, $6) RETURNING `+sessionColumns,
		uuid.New(), userID, tokenHash, userAgent, ip, expiresAt))
}

func (p *Postgres) SessionByTokenHash(ctx context.Context, tokenHash []byte) (*SessionRecord, error) {
	return scanSession(p.pool.QueryRow(ctx,
		`SELECT `+sessionColumns+` FROM sessions WHERE token_hash = $1 AND expires_at > now()`, tokenHash))
}

// TouchSession extends a session's life on use (sliding expiry).
func (p *Postgres) TouchSession(ctx context.Context, id uuid.UUID, expiresAt time.Time) error {
	_, err := p.pool.Exec(ctx, `UPDATE sessions SET last_seen_at = now(), expires_at = $2 WHERE id = $1`, id, expiresAt)
	return translate(err)
}

func (p *Postgres) DeleteSession(ctx context.Context, id uuid.UUID) error {
	_, err := p.pool.Exec(ctx, `DELETE FROM sessions WHERE id = $1`, id)
	return translate(err)
}

func (p *Postgres) DeleteUserSessions(ctx context.Context, userID uuid.UUID, except uuid.UUID) error {
	_, err := p.pool.Exec(ctx, `DELETE FROM sessions WHERE user_id = $1 AND id <> $2`, userID, except)
	return translate(err)
}

func (p *Postgres) ListSessions(ctx context.Context, userID uuid.UUID) ([]SessionRecord, error) {
	rows, err := p.pool.Query(ctx,
		`SELECT `+sessionColumns+` FROM sessions WHERE user_id = $1 AND expires_at > now() ORDER BY last_seen_at DESC`, userID)
	if err != nil {
		return nil, translate(err)
	}
	defer rows.Close()

	out := []SessionRecord{}
	for rows.Next() {
		var s SessionRecord
		if err := rows.Scan(&s.ID, &s.UserID, &s.UserAgent, &s.IP, &s.CreatedAt, &s.LastSeenAt, &s.ExpiresAt); err != nil {
			return nil, translate(err)
		}
		out = append(out, s)
	}
	return out, translate(rows.Err())
}

func (p *Postgres) DeleteExpiredSessions(ctx context.Context) (int64, error) {
	tag, err := p.pool.Exec(ctx, `DELETE FROM sessions WHERE expires_at < now()`)
	if err != nil {
		return 0, translate(err)
	}
	return tag.RowsAffected(), nil
}

// --- password resets -----------------------------------------------------

func (p *Postgres) CreatePasswordReset(ctx context.Context, userID uuid.UUID, tokenHash []byte, expiresAt time.Time) error {
	_, err := p.pool.Exec(ctx,
		`INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
		uuid.New(), userID, tokenHash, expiresAt)
	return translate(err)
}

// ConsumePasswordReset atomically marks a token used and returns its user. A
// second call with the same token returns ErrNotFound.
func (p *Postgres) ConsumePasswordReset(ctx context.Context, tokenHash []byte) (uuid.UUID, error) {
	var userID uuid.UUID
	err := p.pool.QueryRow(ctx,
		`UPDATE password_resets SET used_at = now()
		 WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
		 RETURNING user_id`, tokenHash).Scan(&userID)
	if err != nil {
		return uuid.Nil, translate(err)
	}
	return userID, nil
}

// --- settings ------------------------------------------------------------

func (p *Postgres) Settings(ctx context.Context, userID uuid.UUID) (models.Settings, error) {
	var s models.Settings
	err := p.pool.QueryRow(ctx,
		`SELECT default_player_count, default_starting_life, default_layout_id, theme, haptics_enabled, updated_at
		 FROM user_settings WHERE user_id = $1`, userID).
		Scan(&s.DefaultPlayerCount, &s.DefaultStartingLife, &s.DefaultLayoutID, &s.Theme, &s.HapticsEnabled, &s.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.DefaultSettings(), nil
	}
	if err != nil {
		return models.Settings{}, translate(err)
	}
	return s, nil
}

func (p *Postgres) SaveSettings(ctx context.Context, userID uuid.UUID, in models.Settings) (models.Settings, error) {
	var s models.Settings
	err := p.pool.QueryRow(ctx,
		`INSERT INTO user_settings (user_id, default_player_count, default_starting_life, default_layout_id, theme, haptics_enabled, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, now())
		 ON CONFLICT (user_id) DO UPDATE SET
		   default_player_count  = EXCLUDED.default_player_count,
		   default_starting_life = EXCLUDED.default_starting_life,
		   default_layout_id     = EXCLUDED.default_layout_id,
		   theme                 = EXCLUDED.theme,
		   haptics_enabled       = EXCLUDED.haptics_enabled,
		   updated_at            = now()
		 RETURNING default_player_count, default_starting_life, default_layout_id, theme, haptics_enabled, updated_at`,
		userID, in.DefaultPlayerCount, in.DefaultStartingLife, in.DefaultLayoutID, in.Theme, in.HapticsEnabled).
		Scan(&s.DefaultPlayerCount, &s.DefaultStartingLife, &s.DefaultLayoutID, &s.Theme, &s.HapticsEnabled, &s.UpdatedAt)
	if err != nil {
		return models.Settings{}, translate(err)
	}
	return s, nil
}

// --- profiles ------------------------------------------------------------

const profileColumns = `id, display_name, color, background_kind, card_scryfall_id, card_name,
	card_image_uri, card_focus_x, card_focus_y, saved_colors, created_at, updated_at`

func scanProfile(row pgx.Row) (*models.Profile, error) {
	var (
		p        models.Profile
		card     models.CardBackground
		colors   []string
		focusX   float64
		focusY   float64
		imageURI string
	)
	err := row.Scan(&p.ID, &p.DisplayName, &p.Color, &p.Background,
		&card.ScryfallID, &card.Name, &imageURI, &focusX, &focusY,
		&colors, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, translate(err)
	}
	if colors == nil {
		colors = []string{}
	}
	p.SavedColors = colors
	if imageURI != "" {
		card.ImageURI = imageURI
		card.FocusX = focusX
		card.FocusY = focusY
		p.Card = &card
	}
	return &p, nil
}

func (p *Postgres) ListProfiles(ctx context.Context, userID uuid.UUID) ([]models.Profile, error) {
	rows, err := p.pool.Query(ctx,
		`SELECT `+profileColumns+` FROM profiles WHERE user_id = $1 ORDER BY lower(display_name)`, userID)
	if err != nil {
		return nil, translate(err)
	}
	defer rows.Close()

	out := []models.Profile{}
	for rows.Next() {
		profile, err := scanProfile(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *profile)
	}
	return out, translate(rows.Err())
}

func (p *Postgres) CreateProfile(ctx context.Context, userID uuid.UUID, in models.Profile) (*models.Profile, error) {
	card := in.Card
	if card == nil {
		card = &models.CardBackground{FocusX: 0.5, FocusY: 0.5}
	}
	if in.SavedColors == nil {
		in.SavedColors = []string{}
	}
	return scanProfile(p.pool.QueryRow(ctx,
		`INSERT INTO profiles (id, user_id, display_name, color, background_kind,
			card_scryfall_id, card_name, card_image_uri, card_focus_x, card_focus_y, saved_colors)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		 RETURNING `+profileColumns,
		uuid.New(), userID, in.DisplayName, in.Color, in.Background,
		card.ScryfallID, card.Name, card.ImageURI, card.FocusX, card.FocusY, in.SavedColors))
}

func (p *Postgres) Profile(ctx context.Context, userID, id uuid.UUID) (*models.Profile, error) {
	return scanProfile(p.pool.QueryRow(ctx,
		`SELECT `+profileColumns+` FROM profiles WHERE user_id = $1 AND id = $2`, userID, id))
}

func (p *Postgres) UpdateProfile(ctx context.Context, userID, id uuid.UUID, patch models.ProfilePatch) (*models.Profile, error) {
	current, err := p.Profile(ctx, userID, id)
	if err != nil {
		return nil, err
	}

	if patch.DisplayName != nil {
		current.DisplayName = *patch.DisplayName
	}
	if patch.Color != nil {
		current.Color = *patch.Color
	}
	if patch.Background != nil {
		current.Background = *patch.Background
	}
	switch {
	case patch.ClearCard:
		current.Card = nil
	case patch.Card != nil:
		current.Card = patch.Card
	}

	card := current.Card
	if card == nil {
		card = &models.CardBackground{FocusX: 0.5, FocusY: 0.5}
	}
	return scanProfile(p.pool.QueryRow(ctx,
		`UPDATE profiles SET display_name = $3, color = $4, background_kind = $5,
			card_scryfall_id = $6, card_name = $7, card_image_uri = $8,
			card_focus_x = $9, card_focus_y = $10, updated_at = now()
		 WHERE user_id = $1 AND id = $2
		 RETURNING `+profileColumns,
		userID, id, current.DisplayName, current.Color, current.Background,
		card.ScryfallID, card.Name, card.ImageURI, card.FocusX, card.FocusY))
}

func (p *Postgres) DeleteProfile(ctx context.Context, userID, id uuid.UUID) error {
	tag, err := p.pool.Exec(ctx, `DELETE FROM profiles WHERE user_id = $1 AND id = $2`, userID, id)
	if err != nil {
		return translate(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (p *Postgres) SetProfileColors(ctx context.Context, userID, id uuid.UUID, colors []string) (*models.Profile, error) {
	if colors == nil {
		colors = []string{}
	}
	return scanProfile(p.pool.QueryRow(ctx,
		`UPDATE profiles SET saved_colors = $3, updated_at = now()
		 WHERE user_id = $1 AND id = $2 RETURNING `+profileColumns,
		userID, id, colors))
}
