// Package turnstile verifies Cloudflare Turnstile tokens on the server (TZ SEC-04).
//
// The browser widget (site key) produces a one-time token; the server confirms it with
// Cloudflare's siteverify endpoint using the secret key. Tokens are valid for 5 minutes
// and only once.
package turnstile

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/netip"
	"net/url"
	"strings"
	"time"
)

// DefaultURL is Cloudflare's verification endpoint.
const DefaultURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

// maxToken: real tokens are ~2 KB at most; anything longer is rejected unseen.
const maxToken = 2048

// Verifier checks tokens with the secret key.
type Verifier struct {
	secret string
	// Hostname, when set, must match the site the token was solved on (tokens from
	// another site using the same key are refused).
	Hostname string
	// URL overrides the siteverify endpoint (tests).
	URL  string
	HTTP *http.Client
}

func New(secret, hostname string) *Verifier {
	return &Verifier{secret: secret, Hostname: hostname, URL: DefaultURL, HTTP: &http.Client{Timeout: 5 * time.Second}}
}

// Result is Cloudflare's answer.
type Result struct {
	Success    bool     `json:"success"`
	ErrorCodes []string `json:"error-codes"`
	Hostname   string   `json:"hostname"`
	Action     string   `json:"action"`
}

// Verify reports whether token is a fresh, valid solution from ip. An error means
// Cloudflare could not be asked (network, 5xx); the caller decides whether to fail open.
func (v *Verifier) Verify(ctx context.Context, token string, ip netip.Addr) (bool, error) {
	token = strings.TrimSpace(token)
	if token == "" || len(token) > maxToken {
		return false, nil
	}
	form := url.Values{"secret": {v.secret}, "response": {token}}
	if ip.IsValid() {
		form.Set("remoteip", ip.String())
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, v.URL, strings.NewReader(form.Encode()))
	if err != nil {
		return false, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := v.HTTP.Do(req)
	if err != nil {
		return false, fmt.Errorf("turnstile: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("turnstile: siteverify answered %d", resp.StatusCode)
	}
	var r Result
	if err := json.NewDecoder(io.LimitReader(resp.Body, 64<<10)).Decode(&r); err != nil {
		return false, fmt.Errorf("turnstile: %w", err)
	}
	if !r.Success {
		// internal-error is Cloudflare's own failure, not a bad token.
		for _, c := range r.ErrorCodes {
			if c == "internal-error" {
				return false, fmt.Errorf("turnstile: internal-error")
			}
		}
		return false, nil
	}
	if v.Hostname != "" && !strings.EqualFold(r.Hostname, v.Hostname) {
		return false, nil
	}
	return true, nil
}
