-- Core identity tables.

CREATE TABLE users (
    id            UUID PRIMARY KEY,
    email         TEXT        NOT NULL,
    password_hash TEXT        NOT NULL,
    display_name  TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_key ON users (lower(email));

-- Opaque session tokens. We store only a SHA-256 of the token so a database
-- leak does not hand out live sessions.
CREATE TABLE sessions (
    id           UUID PRIMARY KEY,
    user_id      UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash   BYTEA       NOT NULL UNIQUE,
    user_agent   TEXT        NOT NULL DEFAULT '',
    ip           TEXT        NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

CREATE TABLE password_resets (
    id         UUID PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash BYTEA       NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ
);

CREATE INDEX password_resets_user_id_idx ON password_resets (user_id);

CREATE TABLE user_settings (
    user_id               UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    default_player_count  INT         NOT NULL DEFAULT 4,
    default_starting_life INT         NOT NULL DEFAULT 40,
    default_layout_id     TEXT        NOT NULL DEFAULT '',
    theme                 TEXT        NOT NULL DEFAULT 'dark',
    haptics_enabled       BOOLEAN     NOT NULL DEFAULT TRUE,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A "profile" is a friend the owning user plays with. Everything is scoped to
-- user_id; the profile id never leaves the owner's account.
CREATE TABLE profiles (
    id               UUID PRIMARY KEY,
    user_id          UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    display_name     TEXT        NOT NULL,
    color            TEXT        NOT NULL DEFAULT '#334155',
    background_kind  TEXT        NOT NULL DEFAULT 'color',
    card_scryfall_id TEXT        NOT NULL DEFAULT '',
    card_name        TEXT        NOT NULL DEFAULT '',
    card_image_uri   TEXT        NOT NULL DEFAULT '',
    card_focus_x     REAL        NOT NULL DEFAULT 0.5,
    card_focus_y     REAL        NOT NULL DEFAULT 0.5,
    saved_colors     TEXT[]      NOT NULL DEFAULT '{}',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT profiles_background_kind_check CHECK (background_kind IN ('color', 'image')),
    CONSTRAINT profiles_saved_colors_max CHECK (array_length(saved_colors, 1) IS NULL OR array_length(saved_colors, 1) <= 8)
);

CREATE INDEX profiles_user_id_idx ON profiles (user_id);
CREATE UNIQUE INDEX profiles_user_display_name_key ON profiles (user_id, lower(display_name));
