package httpapi

import (
	"net/http"
	"strconv"
	"sync"
	"time"
)

// rateLimiter is an in-memory fixed-window counter keyed by "route:ip". It is
// deliberately process-local: it blunts credential stuffing on a single node
// without adding a Redis dependency. Swap for a shared store when we run more
// than one replica.
type rateLimiter struct {
	mu      sync.Mutex
	windows map[string]*window
}

type window struct {
	count   int
	resetAt time.Time
}

func newRateLimiter() *rateLimiter {
	rl := &rateLimiter{windows: make(map[string]*window)}
	go rl.reap()
	return rl
}

func (rl *rateLimiter) reap() {
	for range time.Tick(5 * time.Minute) {
		rl.mu.Lock()
		now := time.Now()
		for k, w := range rl.windows {
			if now.After(w.resetAt) {
				delete(rl.windows, k)
			}
		}
		rl.mu.Unlock()
	}
}

func (rl *rateLimiter) allow(key string, limit int, per time.Duration) (bool, time.Duration) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	w, ok := rl.windows[key]
	if !ok || now.After(w.resetAt) {
		rl.windows[key] = &window{count: 1, resetAt: now.Add(per)}
		return true, 0
	}
	if w.count >= limit {
		return false, time.Until(w.resetAt)
	}
	w.count++
	return true, 0
}

func (s *Server) rateLimit(limit int, per time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := r.URL.Path + ":" + clientIP(r)
			ok, retryIn := s.limiter.allow(key, limit, per)
			if !ok {
				w.Header().Set("Retry-After", formatSeconds(retryIn))
				writeError(w, r, &APIError{
					Status:  http.StatusTooManyRequests,
					Code:    "rate_limited",
					Message: "too many requests, try again shortly",
				})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// formatSeconds renders a Retry-After value, which must be whole seconds.
func formatSeconds(d time.Duration) string {
	secs := int(d.Round(time.Second).Seconds())
	if secs < 1 {
		secs = 1
	}
	return strconv.Itoa(secs)
}
