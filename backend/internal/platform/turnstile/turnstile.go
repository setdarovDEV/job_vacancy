// Package turnstile verifies Cloudflare Turnstile tokens (siteverify).
package turnstile

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/netip"
	"net/url"
	"strings"
	"time"
)

const verifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

type Client struct {
	Secret string
	// Hostname the token must have been issued on (the site's host); empty = any. A token
	// solved on another site with the same key is refused.
	Hostname string
	HTTP     *http.Client
	URL      string // tests; defaults to Cloudflare
}

func New(secret, hostname string) *Client {
	return &Client{Secret: secret, Hostname: hostname, HTTP: &http.Client{Timeout: 8 * time.Second}}
}

// Verify reports whether the token is valid (ok=false: the visitor failed). err means
// Cloudflare couldn't be asked; callers fail closed.
func (c *Client) Verify(ctx context.Context, token string, ip netip.Addr) (bool, error) {
	form := url.Values{"secret": {c.Secret}, "response": {token}}
	if ip.IsValid() {
		form.Set("remoteip", ip.String())
	}
	u := c.URL
	if u == "" {
		u = verifyURL
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u, strings.NewReader(form.Encode()))
	if err != nil {
		return false, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	res, err := c.HTTP.Do(req)
	if err != nil {
		return false, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return false, fmt.Errorf("turnstile: status %d", res.StatusCode)
	}
	var out struct {
		Success  bool   `json:"success"`
		Hostname string `json:"hostname"`
	}
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return false, err
	}
	if c.Hostname != "" && !strings.EqualFold(out.Hostname, c.Hostname) {
		return false, nil
	}
	return out.Success, nil
}
