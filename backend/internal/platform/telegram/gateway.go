// Package telegram delivers phone verification codes through the Telegram Gateway API
// (https://core.telegram.org/gateway/api). The code arrives in the user's Telegram app
// from the official "Verification Codes" chat, which is cheaper and more reliable than SMS.
package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"
)

const baseURL = "https://gatewayapi.telegram.org/"

// ErrCannotSend means the number has no Telegram account (or the gateway refuses it).
var ErrCannotSend = errors.New("telegram: cannot send verification to this number")

type CodeSender interface {
	// SendCode delivers our own generated code; verification stays on our side.
	SendCode(ctx context.Context, phone, code string, ttl time.Duration) error
}

type Gateway struct {
	token string
	http  *http.Client
}

func NewGateway(token string) *Gateway {
	return &Gateway{token: token, http: &http.Client{Timeout: 10 * time.Second}}
}

type apiResponse struct {
	OK     bool            `json:"ok"`
	Error  string          `json:"error"`
	Result json.RawMessage `json:"result"`
}

type requestStatus struct {
	RequestID string `json:"request_id"`
}

func (g *Gateway) SendCode(ctx context.Context, phone, code string, ttl time.Duration) error {
	// checkSendAbility reserves a free request_id; it fails fast when the number has no Telegram.
	var ability requestStatus
	if err := g.call(ctx, "checkSendAbility", map[string]any{"phone_number": phone}, &ability); err != nil {
		return err
	}
	body := map[string]any{
		"phone_number": phone,
		"request_id":   ability.RequestID,
		"code":         code,
		"ttl":          clampTTL(ttl),
	}
	return g.call(ctx, "sendVerificationMessage", body, nil)
}

func (g *Gateway) call(ctx context.Context, method string, body map[string]any, out any) error {
	buf, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+method, bytes.NewReader(buf))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+g.token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := g.http.Do(req)
	if err != nil {
		return fmt.Errorf("telegram: %s: %w", method, err)
	}
	defer resp.Body.Close()

	var r apiResponse
	if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
		return fmt.Errorf("telegram: %s: decode: %w", method, err)
	}
	if !r.OK {
		// PHONE_NUMBER_INVALID, PHONE_NUMBER_NOT_FOUND etc. are user-side problems.
		if method == "checkSendAbility" {
			return fmt.Errorf("%w: %s", ErrCannotSend, r.Error)
		}
		return fmt.Errorf("telegram: %s: %s", method, r.Error)
	}
	if out != nil {
		return json.Unmarshal(r.Result, out)
	}
	return nil
}

// Gateway accepts a ttl of 30..3600 seconds; undelivered messages are refunded after it.
func clampTTL(ttl time.Duration) int {
	s := int(ttl.Seconds())
	return max(30, min(s, 3600))
}

// LogSender is used in development when no gateway token is configured.
type LogSender struct{ Log *slog.Logger }

func (l LogSender) SendCode(_ context.Context, phone, code string, _ time.Duration) error {
	l.Log.Warn("DEV: telegram verification code (not sent)", "phone", phone, "code", code)
	return nil
}
