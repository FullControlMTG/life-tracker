// Package scryfall is a thin, cached, rate-limited proxy for the public
// Scryfall API. We proxy rather than calling from the browser so the polite
// request rate is enforced once, centrally, and responses are cached.
package scryfall

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const (
	baseURL   = "https://api.scryfall.com"
	userAgent = "fullcontrolmtg-life-tracker/0.1 (+https://github.com/fullcontrolmtg/life-tracker)"
	// Scryfall asks for 50-100ms between requests.
	minInterval = 100 * time.Millisecond
	cacheTTL    = 12 * time.Hour
)

// ErrUpstream means Scryfall answered with something we cannot use.
var ErrUpstream = errors.New("scryfall: upstream error")

// Card is the trimmed shape the frontend needs: enough to show a picker row and
// set a background.
type Card struct {
	ScryfallID string `json:"scryfallId"`
	Name       string `json:"name"`
	SetName    string `json:"setName"`
	// ArtCropURI is the cropped illustration only - the right choice for a
	// player background, since full card images carry borders and text.
	ArtCropURI string `json:"artCropUri"`
	NormalURI  string `json:"normalUri"`
}

type Client struct {
	http *http.Client

	// gate serialises outbound calls and spaces them by minInterval.
	gate     sync.Mutex
	lastCall time.Time

	cacheMu sync.RWMutex
	cache   map[string]cacheEntry
}

type cacheEntry struct {
	body      []byte
	expiresAt time.Time
}

func NewClient() *Client {
	return &Client{
		http:  &http.Client{Timeout: 8 * time.Second},
		cache: make(map[string]cacheEntry),
	}
}

// Autocomplete returns up to 20 card-name suggestions.
func (c *Client) Autocomplete(ctx context.Context, query string) ([]string, error) {
	query = strings.TrimSpace(query)
	if len(query) < 2 {
		return []string{}, nil
	}

	body, err := c.get(ctx, "/cards/autocomplete?q="+url.QueryEscape(query))
	if err != nil {
		return nil, err
	}
	var payload struct {
		Data []string `json:"data"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUpstream, err)
	}
	if payload.Data == nil {
		payload.Data = []string{}
	}
	return payload.Data, nil
}

// Search returns distinct artworks matching query. A no-match search is not an
// error: Scryfall answers 404, which we surface as an empty list.
func (c *Client) Search(ctx context.Context, query string) ([]Card, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return []Card{}, nil
	}

	body, err := c.get(ctx, "/cards/search?unique=art&order=released&q="+url.QueryEscape(query))
	if err != nil {
		if errors.Is(err, errNoResults) {
			return []Card{}, nil
		}
		return nil, err
	}

	var payload struct {
		Data []rawCard `json:"data"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUpstream, err)
	}

	out := make([]Card, 0, len(payload.Data))
	for _, rc := range payload.Data {
		art, normal := rc.images()
		if art == "" {
			continue
		}
		out = append(out, Card{
			ScryfallID: rc.ID,
			Name:       rc.Name,
			SetName:    rc.SetName,
			ArtCropURI: art,
			NormalURI:  normal,
		})
	}
	return out, nil
}

type imageURIs struct {
	ArtCrop string `json:"art_crop"`
	Normal  string `json:"normal"`
	Large   string `json:"large"`
}

type rawCard struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	SetName   string    `json:"set_name"`
	ImageURIs imageURIs `json:"image_uris"`
	CardFaces []struct {
		Name      string    `json:"name"`
		ImageURIs imageURIs `json:"image_uris"`
	} `json:"card_faces"`
}

// images falls back to the front face for double-faced cards, which carry no
// top-level image_uris.
func (rc rawCard) images() (art, normal string) {
	uris := rc.ImageURIs
	if uris.ArtCrop == "" && len(rc.CardFaces) > 0 {
		uris = rc.CardFaces[0].ImageURIs
	}
	normal = uris.Normal
	if normal == "" {
		normal = uris.Large
	}
	return uris.ArtCrop, normal
}

var errNoResults = errors.New("scryfall: no results")

func (c *Client) get(ctx context.Context, path string) ([]byte, error) {
	if body, ok := c.cached(path); ok {
		return body, nil
	}

	c.gate.Lock()
	if wait := minInterval - time.Since(c.lastCall); wait > 0 {
		select {
		case <-time.After(wait):
		case <-ctx.Done():
			c.gate.Unlock()
			return nil, ctx.Err()
		}
	}
	c.lastCall = time.Now()
	c.gate.Unlock()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUpstream, err)
	}
	defer resp.Body.Close()

	body, err := readAll(resp)
	if err != nil {
		return nil, err
	}
	switch {
	case resp.StatusCode == http.StatusNotFound:
		return nil, errNoResults
	case resp.StatusCode != http.StatusOK:
		return nil, fmt.Errorf("%w: status %d", ErrUpstream, resp.StatusCode)
	}

	c.store(path, body)
	return body, nil
}

const maxUpstreamBytes = 4 << 20

func readAll(resp *http.Response) ([]byte, error) {
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxUpstreamBytes))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUpstream, err)
	}
	return body, nil
}

func (c *Client) cached(key string) ([]byte, bool) {
	c.cacheMu.RLock()
	entry, ok := c.cache[key]
	c.cacheMu.RUnlock()
	if !ok || time.Now().After(entry.expiresAt) {
		return nil, false
	}
	return entry.body, true
}

const maxCacheEntries = 2000

func (c *Client) store(key string, body []byte) {
	c.cacheMu.Lock()
	defer c.cacheMu.Unlock()
	// Crude bound: card data is immutable enough that dropping the whole map
	// occasionally is cheaper than tracking an LRU.
	if len(c.cache) >= maxCacheEntries {
		c.cache = make(map[string]cacheEntry, maxCacheEntries)
	}
	c.cache[key] = cacheEntry{body: body, expiresAt: time.Now().Add(cacheTTL)}
}
