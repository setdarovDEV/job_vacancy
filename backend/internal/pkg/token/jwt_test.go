package token

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func TestIssueParse(t *testing.T) {
	m := NewManager("0123456789abcdef0123456789abcdef", "test", time.Minute)
	uid, sid := uuid.New(), uuid.New()
	raw, _, err := m.Issue(uid, sid, "seeker", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	c, err := m.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	if c.UserID != uid || c.SessionID != sid || c.Role != "seeker" {
		t.Fatalf("claims mismatch: %+v", c)
	}

	expired, _, _ := m.Issue(uid, sid, "seeker", time.Now().Add(-time.Hour))
	if _, err := m.Parse(expired); err == nil {
		t.Fatal("expired token accepted")
	}
	other := NewManager("ffffffffffffffffffffffffffffffff", "test", time.Minute)
	if _, err := other.Parse(raw); err == nil {
		t.Fatal("token signed with another key accepted")
	}
}

func TestKeyRotation(t *testing.T) {
	oldKey := Key{ID: "k1", Secret: []byte("0123456789abcdef0123456789abcdef")}
	newKey := Key{ID: "k2", Secret: []byte("fedcba9876543210fedcba9876543210")}
	uid, sid := uuid.New(), uuid.New()
	now := time.Now()

	before := NewRotatingManager(oldKey, nil, "test", time.Minute)
	oldTok, _, _ := before.Issue(uid, sid, "seeker", now)

	during := NewRotatingManager(newKey, &oldKey, "test", time.Minute)
	newTok, _, _ := during.Issue(uid, sid, "seeker", now)
	if kid := headerKid(t, newTok); kid != "k2" {
		t.Fatalf("new tokens must be signed with the current key, kid=%q", kid)
	}
	for name, tok := range map[string]string{"old": oldTok, "new": newTok} {
		if _, err := during.Parse(tok); err != nil {
			t.Errorf("%s token rejected during rotation: %v", name, err)
		}
	}

	after := NewRotatingManager(newKey, nil, "test", time.Minute)
	if _, err := after.Parse(oldTok); err == nil {
		t.Error("token signed with a retired key accepted")
	}
	if _, err := after.Parse(newTok); err != nil {
		t.Errorf("current token rejected: %v", err)
	}

	// A token claiming the current kid but signed with the old secret must fail.
	forged := jwt.NewWithClaims(jwt.SigningMethodHS256, Claims{RegisteredClaims: jwt.RegisteredClaims{
		Subject: uid.String(), Issuer: "test", ExpiresAt: jwt.NewNumericDate(now.Add(time.Minute)),
	}})
	forged.Header["kid"] = "k2"
	raw, _ := forged.SignedString(oldKey.Secret)
	if _, err := during.Parse(raw); err == nil {
		t.Error("kid/secret mismatch accepted")
	}
}

func TestLegacyTokenWithoutKid(t *testing.T) {
	oldKey := Key{ID: "k1", Secret: []byte("0123456789abcdef0123456789abcdef")}
	newKey := Key{ID: "k2", Secret: []byte("fedcba9876543210fedcba9876543210")}
	uid := uuid.New()
	legacy := jwt.NewWithClaims(jwt.SigningMethodHS256, Claims{Role: "seeker", RegisteredClaims: jwt.RegisteredClaims{
		Subject: uid.String(), Issuer: "test", ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Minute)),
	}})
	raw, _ := legacy.SignedString(oldKey.Secret) // no kid header, as before this change
	m := NewRotatingManager(newKey, &oldKey, "test", time.Minute)
	c, err := m.Parse(raw)
	if err != nil || c.UserID != uid {
		t.Fatalf("legacy token rejected: %v", err)
	}
	if _, err := NewRotatingManager(Key{ID: "k3", Secret: []byte("ffffffffffffffffffffffffffffffff")}, nil, "test", time.Minute).Parse(raw); err == nil {
		t.Fatal("legacy token accepted by an unrelated key")
	}
	unknown := jwt.NewWithClaims(jwt.SigningMethodHS256, Claims{RegisteredClaims: jwt.RegisteredClaims{
		Subject: uid.String(), Issuer: "test", ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Minute)),
	}})
	unknown.Header["kid"] = "k9"
	raw, _ = unknown.SignedString(newKey.Secret)
	if _, err := m.Parse(raw); err == nil {
		t.Fatal("unknown kid accepted")
	}
}

func headerKid(t *testing.T, raw string) string {
	t.Helper()
	tok, _, err := jwt.NewParser().ParseUnverified(raw, &Claims{})
	if err != nil {
		t.Fatal(err)
	}
	kid, _ := tok.Header["kid"].(string)
	return kid
}
