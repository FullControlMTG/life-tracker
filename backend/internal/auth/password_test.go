package auth

import (
	"bytes"
	"testing"
)

func TestHashAndVerifyPassword(t *testing.T) {
	const pw = "correct-horse-battery-staple"

	hash, err := HashPassword(pw)
	if err != nil {
		t.Fatal(err)
	}

	ok, err := VerifyPassword(pw, hash)
	if err != nil || !ok {
		t.Fatalf("correct password rejected: ok=%v err=%v", ok, err)
	}

	ok, err = VerifyPassword(pw+"x", hash)
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Error("wrong password accepted")
	}
}

// A fresh salt per hash means two accounts with the same password do not share
// a digest.
func TestHashPasswordIsSalted(t *testing.T) {
	a, _ := HashPassword("same-password-both-times")
	b, _ := HashPassword("same-password-both-times")
	if a == b {
		t.Error("two hashes of the same password are identical; salt is not random")
	}
}

func TestVerifyPasswordRejectsMalformedHash(t *testing.T) {
	for _, bad := range []string{"", "plaintext", "$argon2i$v=19$m=1,t=1,p=1$YQ$Yg", "$argon2id$nope"} {
		if _, err := VerifyPassword("x", bad); err == nil {
			t.Errorf("VerifyPassword accepted malformed hash %q", bad)
		}
	}
}

func TestNewTokenIsUniqueAndDigestMatches(t *testing.T) {
	t1, d1, err := NewToken()
	if err != nil {
		t.Fatal(err)
	}
	t2, _, err := NewToken()
	if err != nil {
		t.Fatal(err)
	}

	if t1 == t2 {
		t.Error("two tokens collided")
	}
	if !bytes.Equal(d1, HashToken(t1)) {
		t.Error("digest does not match a re-hash of the token")
	}
	if bytes.Contains(d1, []byte(t1)) {
		t.Error("digest leaks the raw token")
	}
}
