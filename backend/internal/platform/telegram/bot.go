package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"
)

// Bot sends notifications through the Telegram Bot API. Users link their account once
// via a t.me deep link; after that we know their chat id.
type Bot interface {
	Send(ctx context.Context, chatID int64, html string, button *Button) error
	Username() string
}

type Button struct {
	Text string `json:"text"`
	URL  string `json:"url"`
}

type BotAPI struct {
	token    string
	username string
	http     *http.Client
}

func NewBot(token, username string) *BotAPI {
	return &BotAPI{token: token, username: username, http: &http.Client{Timeout: 10 * time.Second}}
}

func (b *BotAPI) Username() string { return b.username }

// ErrBlocked means the user blocked the bot or deleted the chat; stop sending to it.
var ErrBlocked = fmt.Errorf("telegram: bot blocked by user")

func (b *BotAPI) Send(ctx context.Context, chatID int64, html string, button *Button) error {
	body := map[string]any{
		"chat_id": chatID, "text": html, "parse_mode": "HTML",
		"link_preview_options": map[string]bool{"is_disabled": true},
	}
	if button != nil {
		body["reply_markup"] = map[string]any{"inline_keyboard": [][]Button{{*button}}}
	}
	return b.call(ctx, "sendMessage", body)
}

// SetWebhook points Telegram at our webhook; secret is echoed in every update's
// X-Telegram-Bot-Api-Secret-Token header so we can reject forged requests.
func (b *BotAPI) SetWebhook(ctx context.Context, url, secret string) error {
	return b.call(ctx, "setWebhook", map[string]any{
		"url": url, "secret_token": secret, "allowed_updates": []string{"message"},
	})
}

func (b *BotAPI) call(ctx context.Context, method string, body any) error {
	buf, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://api.telegram.org/bot"+b.token+"/"+method, bytes.NewReader(buf))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := b.http.Do(req)
	if err != nil {
		return fmt.Errorf("telegram bot: %s: %w", method, err)
	}
	defer resp.Body.Close()
	var r struct {
		OK          bool   `json:"ok"`
		ErrorCode   int    `json:"error_code"`
		Description string `json:"description"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&r)
	if r.OK {
		return nil
	}
	if r.ErrorCode == http.StatusForbidden {
		return ErrBlocked
	}
	return fmt.Errorf("telegram bot: %s: %d %s", method, r.ErrorCode, r.Description)
}

// LogBot is used when no bot token is configured (development).
type LogBot struct{ Log *slog.Logger }

func (l LogBot) Username() string { return "jobvacancy_dev_bot" }

func (l LogBot) Send(_ context.Context, chatID int64, html string, button *Button) error {
	l.Log.Info("DEV: telegram message (not sent)", "chat_id", chatID, "text", html, "button", button)
	return nil
}
