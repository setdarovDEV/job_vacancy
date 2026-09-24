// Package token issues and parses short-lived JWT access tokens.
//
// Tokens are HS256 and carry the signing key's id in the "kid" header. The manager holds
// the current key (signs and verifies) and optionally the previous one (verifies only),
// so a secret can be rotated without logging everybody out: deploy the new key with the
// old one as previous, wait one access-token TTL, then drop the previous key.
package token

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var ErrInvalid = errors.New("token: invalid or expired")

type Claims struct {
	UserID    uuid.UUID `json:"-"`
	SessionID uuid.UUID `json:"sid"`
	Role      string    `json:"role"`
	jwt.RegisteredClaims
}

// Key is an HMAC signing key and its id.
type Key struct {
	ID     string
	Secret []byte
}

type Manager struct {
	current  Key
	previous *Key
	issuer   string
	ttl      time.Duration
}

// NewManager builds a manager with a single key (id "k1").
func NewManager(secret, issuer string, ttl time.Duration) *Manager {
	return NewRotatingManager(Key{ID: "k1", Secret: []byte(secret)}, nil, issuer, ttl)
}

// NewRotatingManager signs with current and also accepts tokens signed with previous.
func NewRotatingManager(current Key, previous *Key, issuer string, ttl time.Duration) *Manager {
	return &Manager{current: current, previous: previous, issuer: issuer, ttl: ttl}
}

func (m *Manager) TTL() time.Duration { return m.ttl }

func (m *Manager) Issue(userID, sessionID uuid.UUID, role string, now time.Time) (string, time.Time, error) {
	exp := now.Add(m.ttl)
	c := Claims{
		SessionID: sessionID,
		Role:      role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			Issuer:    m.issuer,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, c)
	t.Header["kid"] = m.current.ID
	s, err := t.SignedString(m.current.Secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("token: sign: %w", err)
	}
	return s, exp, nil
}

// key picks the verification key(s) for a token: by kid when present; tokens issued
// before kids existed are tried against both keys.
func (m *Manager) key(t *jwt.Token) (any, error) {
	kid, _ := t.Header["kid"].(string)
	switch {
	case kid == m.current.ID:
		return m.current.Secret, nil
	case m.previous != nil && kid == m.previous.ID:
		return m.previous.Secret, nil
	case kid == "":
		set := jwt.VerificationKeySet{Keys: []jwt.VerificationKey{m.current.Secret}}
		if m.previous != nil {
			set.Keys = append(set.Keys, m.previous.Secret)
		}
		return set, nil
	default:
		return nil, errors.New("token: unknown kid")
	}
}

func (m *Manager) Parse(raw string) (*Claims, error) {
	var c Claims
	_, err := jwt.ParseWithClaims(raw, &c, m.key,
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(m.issuer),
		jwt.WithExpirationRequired(),
		jwt.WithLeeway(5*time.Second),
	)
	if err != nil {
		return nil, ErrInvalid
	}
	id, err := uuid.Parse(c.Subject)
	if err != nil {
		return nil, ErrInvalid
	}
	c.UserID = id
	return &c, nil
}
