package httpapi

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// newStaticHandler serves the built frontend with a single-page-app fallback:
// a path that is not a real file gets index.html so client-side routes
// deep-link correctly. Mounting this alongside the API means production is
// same-origin, so the session cookie needs no cross-site handling.
func newStaticHandler(dir string) http.Handler {
	files := http.FileServer(http.Dir(dir))
	index := filepath.Join(dir, "index.html")

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Clean against the root first so "../" cannot escape the directory.
		clean := filepath.Clean("/" + r.URL.Path)
		if info, err := os.Stat(filepath.Join(dir, clean)); err == nil && !info.IsDir() {
			// Vite fingerprints asset filenames, so they are safe to cache forever.
			if strings.HasPrefix(clean, "/assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			}
			files.ServeHTTP(w, r)
			return
		}

		w.Header().Set("Cache-Control", "no-cache")
		http.ServeFile(w, r, index)
	})
}
