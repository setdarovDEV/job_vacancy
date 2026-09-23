package auth

import (
	"context"
	"fmt"
	"slices"
	"time"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

const googleJWKS = "https://www.googleapis.com/oauth2/v3/certs"

// GoogleIdentity is what we trust from a verified Google ID token.
type GoogleIdentity struct {
	Subject  string
	Email    string
	Name     string
	Picture  string
	Verified bool
}

// GoogleVerifier checks ID tokens produced by Google Sign-In on web, Android and iOS.
// Google's signing keys are fetched once and refreshed in the background.
type GoogleVerifier struct {
	keys      keyfunc.Keyfunc
	audiences []string
}

func NewGoogleVerifier(ctx context.Context, clientIDs []string) (*GoogleVerifier, error) {
	if len(clientIDs) == 0 {
		return nil, nil // Google sign-in disabled
	}
	k, err := keyfunc.NewDefaultCtx(ctx, []string{googleJWKS})
	if err != nil {
		return nil, fmt.Errorf("google jwks: %w", err)
	}
	return &GoogleVerifier{keys: k, audiences: clientIDs}, nil
}

type googleClaims struct {
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	jwt.RegisteredClaims
}

func (g *GoogleVerifier) Verify(raw string) (*GoogleIdentity, error) {
	var c googleClaims
	_, err := jwt.ParseWithClaims(raw, &c, g.keys.Keyfunc,
		jwt.WithValidMethods([]string{"RS256"}),
		jwt.WithExpirationRequired(),
		jwt.WithLeeway(30*time.Second),
	)
	if err != nil {
		return nil, err
	}
	if c.Issuer != "accounts.google.com" && c.Issuer != "https://accounts.google.com" {
		return nil, fmt.Errorf("unexpected issuer %q", c.Issuer)
	}
	if !slices.ContainsFunc(c.Audience, func(a string) bool { return slices.Contains(g.audiences, a) }) {
		return nil, fmt.Errorf("unexpected audience %v", c.Audience)
	}
	if c.Subject == "" {
		return nil, fmt.Errorf("missing subject")
	}
	return &GoogleIdentity{
		Subject: c.Subject, Email: c.Email, Name: c.Name,
		Picture: c.Picture, Verified: c.EmailVerified,
	}, nil
}
