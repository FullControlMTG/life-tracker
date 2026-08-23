// Command server runs the life-tracker API.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fullcontrolmtg/life-tracker/backend/internal/config"
	"github.com/fullcontrolmtg/life-tracker/backend/internal/httpapi"
	"github.com/fullcontrolmtg/life-tracker/backend/internal/migrations"
	"github.com/fullcontrolmtg/life-tracker/backend/internal/scryfall"
	"github.com/fullcontrolmtg/life-tracker/backend/internal/store"
)

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))

	if err := run(); err != nil {
		slog.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cfg := config.Load()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	if err := store.Migrate(ctx, pool, migrations.FS()); err != nil {
		return err
	}
	slog.Info("migrations up to date")

	db := store.NewPostgres(pool)
	go reapSessions(ctx, db)

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           httpapi.New(cfg, db, scryfall.NewClient()).Routes(),
		ReadHeaderTimeout: 10 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       90 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		slog.Info("listening", "addr", cfg.Addr, "env", cfg.Env)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		slog.Info("shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		return srv.Shutdown(shutdownCtx)
	}
}

// connect retries briefly so `docker compose up` ordering is not a race.
func connect(ctx context.Context, url string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	for attempt := range 10 {
		if err = pool.Ping(ctx); err == nil {
			return pool, nil
		}
		slog.Warn("database not ready, retrying", "attempt", attempt+1, "err", err)
		select {
		case <-time.After(time.Second):
		case <-ctx.Done():
			pool.Close()
			return nil, ctx.Err()
		}
	}
	pool.Close()
	return nil, err
}

func reapSessions(ctx context.Context, db *store.Postgres) {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			n, err := db.DeleteExpiredSessions(ctx)
			if err != nil {
				slog.Error("reap sessions", "err", err)
				continue
			}
			if n > 0 {
				slog.Info("reaped expired sessions", "count", n)
			}
		}
	}
}
