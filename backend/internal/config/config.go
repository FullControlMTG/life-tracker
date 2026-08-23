// Package config loads runtime configuration from the environment.
package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Env          string
	Addr         string
	DatabaseURL  string
	CookieName   string
	CookieDomain string
	CookieSecure bool
	SessionTTL   time.Duration
	ResetTTL     time.Duration
	CORSOrigins  []string
	// StaticDir holds the built frontend. Empty means API-only, which is how
	// local development runs (Vite serves the SPA and proxies /api).
	StaticDir string
}

func Load() Config {
	c := Config{
		Env:          env("APP_ENV", "development"),
		Addr:         env("ADDR", ":8080"),
		DatabaseURL:  env("DATABASE_URL", "postgres://lifetracker:lifetracker@localhost:5433/lifetracker?sslmode=disable"),
		CookieName:   env("SESSION_COOKIE_NAME", "lt_session"),
		CookieDomain: env("SESSION_COOKIE_DOMAIN", ""),
		SessionTTL:   duration("SESSION_TTL", 30*24*time.Hour),
		ResetTTL:     duration("PASSWORD_RESET_TTL", time.Hour),
		CORSOrigins:  list("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"),
		StaticDir:    env("STATIC_DIR", ""),
	}
	// Secure cookies require HTTPS, which localhost dev does not have.
	c.CookieSecure = boolean("SESSION_COOKIE_SECURE", c.Env != "development")
	return c
}

func env(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func duration(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return fallback
}

func boolean(key string, fallback bool) bool {
	if v := os.Getenv(key); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return fallback
}

func list(key, fallback string) []string {
	raw := env(key, fallback)
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
