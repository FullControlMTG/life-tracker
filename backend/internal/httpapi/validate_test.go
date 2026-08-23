package httpapi

import (
	"os"
	"regexp"
	"slices"
	"testing"

	"github.com/fullcontrolmtg/life-tracker/backend/internal/models"
)

func TestPushColorEvictsOldestPastCap(t *testing.T) {
	var colors []string
	for _, hex := range []string{"#111111", "#222222", "#333333", "#444444",
		"#555555", "#666666", "#777777", "#888888", "#999999"} {
		colors = pushColor(colors, hex)
	}

	if len(colors) != models.MaxSavedColors {
		t.Fatalf("len = %d, want %d", len(colors), models.MaxSavedColors)
	}
	if colors[0] != "#999999" {
		t.Errorf("newest colour should be first, got %q", colors[0])
	}
	if slices.Contains(colors, "#111111") {
		t.Error("oldest colour should have been evicted")
	}
}

func TestPushColorMovesExistingToFrontWithoutDuplicating(t *testing.T) {
	colors := []string{"#aaaaaa", "#bbbbbb", "#cccccc"}
	got := pushColor(colors, "#CCCCCC") // different case, same colour

	want := []string{"#CCCCCC", "#aaaaaa", "#bbbbbb"}
	if !slices.Equal(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

func TestRemoveColorIsCaseInsensitive(t *testing.T) {
	got := removeColor([]string{"#aaaaaa", "#bbbbbb"}, "#AAAAAA")
	if !slices.Equal(got, []string{"#bbbbbb"}) {
		t.Errorf("got %v", got)
	}
}

func TestNormalizeHex(t *testing.T) {
	tests := []struct {
		in      string
		want    string
		wantErr bool
	}{
		{"#3B82F6", "#3b82f6", false},
		{"  #abcdef  ", "#abcdef", false},
		{"", "", false}, // empty is "unset", not an error
		{"3b82f6", "", true},
		{"#abc", "", true},
		{"red", "", true},
		{"#zzzzzz", "", true},
	}
	for _, tc := range tests {
		f := fieldErrors{}
		got := normalizeHex(f, "color", tc.in)
		if got != tc.want {
			t.Errorf("normalizeHex(%q) = %q, want %q", tc.in, got, tc.want)
		}
		if (len(f) > 0) != tc.wantErr {
			t.Errorf("normalizeHex(%q) error = %v, want %v", tc.in, len(f) > 0, tc.wantErr)
		}
	}
}

// Profile image URIs end up in an <img src>, so anything off Scryfall's CDN has
// to be rejected before it reaches the database.
func TestValidateCardRejectsForeignHosts(t *testing.T) {
	tests := []struct {
		uri  string
		want bool
	}{
		{"https://cards.scryfall.io/art_crop/front/a/b/c.jpg", true},
		{"https://svgs.scryfall.io/card-symbols/T.svg", true},
		{"https://evil.example.com/tracker.png", false},
		{"http://cards.scryfall.io/insecure.jpg", false},
		{"https://cards.scryfall.io.evil.com/a.jpg", false},
		{"javascript:alert(1)", false},
		{"", false},
	}
	for _, tc := range tests {
		f := fieldErrors{}
		validateCard(f, &models.CardBackground{ImageURI: tc.uri})
		if ok := len(f) == 0; ok != tc.want {
			t.Errorf("validateCard(%q) accepted = %v, want %v", tc.uri, ok, tc.want)
		}
	}
}

func TestValidateCardClampsFocus(t *testing.T) {
	f := fieldErrors{}
	got := validateCard(f, &models.CardBackground{
		ImageURI: "https://cards.scryfall.io/art_crop/a.jpg",
		FocusX:   -3,
		FocusY:   12,
	})
	if got.FocusX != 0 || got.FocusY != 1 {
		t.Errorf("focus = (%v, %v), want (0, 1)", got.FocusX, got.FocusY)
	}
}

func TestValidateEmail(t *testing.T) {
	valid := []string{"a@b.co", "jake+mtg@example.com", "  x@y.org  "}
	invalid := []string{"", "nope", "a@b", "a b@c.com", "@b.com"}

	for _, in := range valid {
		f := fieldErrors{}
		validateEmail(f, in)
		if len(f) != 0 {
			t.Errorf("validateEmail(%q) rejected: %v", in, f)
		}
	}
	for _, in := range invalid {
		f := fieldErrors{}
		validateEmail(f, in)
		if len(f) == 0 {
			t.Errorf("validateEmail(%q) accepted", in)
		}
	}
}

func TestNormalizeSymbol(t *testing.T) {
	tests := []struct {
		in      string
		want    string
		wantErr bool
	}{
		{"crown", "crown", false},
		{"  gem  ", "gem", false},
		{"", "", false}, // no preference is legitimate
		{"Crown", "", true},
		{"wizard", "", true},
		{"<script>", "", true},
	}
	for _, tc := range tests {
		f := fieldErrors{}
		got := normalizeSymbol(f, "symbol", tc.in)
		if got != tc.want {
			t.Errorf("normalizeSymbol(%q) = %q, want %q", tc.in, got, tc.want)
		}
		if (len(f) > 0) != tc.wantErr {
			t.Errorf("normalizeSymbol(%q) error = %v, want %v", tc.in, len(f) > 0, tc.wantErr)
		}
	}
}

// The Go allowlist and the frontend icon list have to agree, or a symbol saved
// in one place renders as nothing in the other.
func TestValidSymbolsMatchesFrontendIconList(t *testing.T) {
	src, err := os.ReadFile("../../../frontend/src/game/icons.ts")
	if err != nil {
		t.Skipf("frontend sources not available: %v", err)
	}
	block := regexp.MustCompile(`PLAYER_SYMBOLS: IconName\[\] = \[([^\]]*)\]`).FindSubmatch(src)
	if block == nil {
		t.Fatal("could not find PLAYER_SYMBOLS in icons.ts")
	}
	found := map[string]bool{}
	for _, m := range regexp.MustCompile(`'([a-z]+)'`).FindAllSubmatch(block[1], -1) {
		found[string(m[1])] = true
	}
	if len(found) == 0 {
		t.Fatal("parsed no symbols from icons.ts")
	}
	for name := range found {
		if !validSymbols[name] {
			t.Errorf("icons.ts offers %q but the server rejects it", name)
		}
	}
	for name := range validSymbols {
		if !found[name] {
			t.Errorf("server accepts %q but icons.ts does not offer it", name)
		}
	}
}
