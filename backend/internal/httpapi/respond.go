// Package httpapi wires the REST surface described in the API design.
package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/fullcontrolmtg/life-tracker/backend/internal/store"
)

// APIError is the single error shape the API ever returns.
type APIError struct {
	Status  int               `json:"-"`
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
}

func (e *APIError) Error() string { return e.Code + ": " + e.Message }

func errBadRequest(msg string, fields map[string]string) *APIError {
	return &APIError{Status: http.StatusBadRequest, Code: "invalid_request", Message: msg, Fields: fields}
}

func errUnauthorized(msg string) *APIError {
	return &APIError{Status: http.StatusUnauthorized, Code: "unauthorized", Message: msg}
}

func errNotFound(msg string) *APIError {
	return &APIError{Status: http.StatusNotFound, Code: "not_found", Message: msg}
}

func errConflict(msg string) *APIError {
	return &APIError{Status: http.StatusConflict, Code: "conflict", Message: msg}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if body == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Error("encode response", "err", err)
	}
}

// writeError maps store errors and *APIError onto the wire format. Anything
// else becomes a 500 with the detail logged rather than leaked.
func writeError(w http.ResponseWriter, r *http.Request, err error) {
	var apiErr *APIError
	switch {
	case errors.As(err, &apiErr):
	case errors.Is(err, store.ErrNotFound):
		apiErr = errNotFound("resource not found")
	case errors.Is(err, store.ErrConflict):
		apiErr = errConflict("that already exists")
	default:
		slog.Error("unhandled error", "err", err, "path", r.URL.Path, "method", r.Method)
		apiErr = &APIError{Status: http.StatusInternalServerError, Code: "internal", Message: "something went wrong"}
	}
	writeJSON(w, apiErr.Status, apiErr)
}

const maxBodyBytes = 1 << 20 // 1 MiB

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return errBadRequest("request body is not valid JSON: "+err.Error(), nil)
	}
	// Reject trailing garbage so `{}{}` is not silently accepted.
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errBadRequest("request body must contain a single JSON object", nil)
	}
	return nil
}

func clientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		if first, _, ok := strings.Cut(fwd, ","); ok {
			return strings.TrimSpace(first)
		}
		return strings.TrimSpace(fwd)
	}
	host, _, ok := strings.Cut(r.RemoteAddr, ":")
	if !ok {
		return r.RemoteAddr
	}
	return host
}
