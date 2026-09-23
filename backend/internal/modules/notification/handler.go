package notification

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/random"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/platform/telegram"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

const telegramLinkTTL = 15 * time.Minute

type Handler struct {
	Svc           *Service
	RDB           *redis.Client
	Bot           telegram.Bot
	WebhookSecret string
}

// MeRoutes are mounted under /me behind RequireAuth.
func (h *Handler) MeRoutes(r chi.Router) {
	r.Get("/notifications", h.list)
	r.Get("/notifications/unread-count", h.unreadCount)
	r.Post("/notifications/read", h.markRead)
	r.Get("/notification-settings", h.getSettings)
	r.Put("/notification-settings", h.putSettings)
	r.Post("/telegram/link", h.telegramLink)
	r.Delete("/telegram", h.telegramUnlink)
	r.Post("/devices", h.addDevice)
	r.Delete("/devices/{token}", h.removeDevice)
}

// WebhookRoutes are public (authenticated by the webhook secret header).
func (h *Handler) WebhookRoutes(r chi.Router) {
	r.Post("/telegram/webhook", h.telegramWebhook)
}

func toDTO(n gen.Notification) DTO {
	var p Payload
	_ = json.Unmarshal(n.Payload, &p)
	return DTO{ID: n.ID, Type: n.Type, Payload: p, ReadAt: n.ReadAt, CreatedAt: n.CreatedAt}
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit := 20
	if s := q.Get("limit"); s != "" {
		n, err := strconv.Atoi(s)
		if err != nil || n < 1 || n > 50 {
			response.Error(w, r, apperr.Validation(map[string]string{"limit": "max=50"}))
			return
		}
		limit = n
	}
	params := gen.ListNotificationsParams{
		UserID: reqctx.MustPrincipal(r.Context()).UserID, UnreadOnly: q.Get("unread") == "true", MaxResults: int32(limit + 1),
	}
	if s := q.Get("cursor"); s != "" { // the cursor is simply the last seen id
		id, err := strconv.ParseInt(s, 10, 64)
		if err != nil {
			response.Error(w, r, apperr.BadRequest("invalid_cursor", "cursor is invalid"))
			return
		}
		params.BeforeID = &id
	}
	rows, err := h.Svc.Q.ListNotifications(r.Context(), params)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	var next *string
	if len(rows) > limit {
		rows = rows[:limit]
		c := strconv.FormatInt(rows[len(rows)-1].ID, 10)
		next = &c
	}
	out := make([]DTO, len(rows))
	for i, n := range rows {
		out[i] = toDTO(n)
	}
	response.List(w, out, map[string]any{"next_cursor": next})
}

func (h *Handler) unreadCount(w http.ResponseWriter, r *http.Request) {
	n, err := h.Svc.Q.CountUnreadNotifications(r.Context(), reqctx.MustPrincipal(r.Context()).UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]int64{"unread": n})
}

type readRequest struct {
	IDs []int64 `json:"ids" validate:"max=200"` // empty = all
}

func (h *Handler) markRead(w http.ResponseWriter, r *http.Request) {
	var req readRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	params := gen.MarkNotificationsReadParams{UserID: reqctx.MustPrincipal(r.Context()).UserID}
	if len(req.IDs) > 0 {
		params.Ids = req.IDs
	}
	if _, err := h.Svc.Q.MarkNotificationsRead(r.Context(), params); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

type settings struct {
	Email          bool   `json:"email"`
	Telegram       bool   `json:"telegram"`
	TelegramLinked bool   `json:"telegram_linked"`
	TelegramBot    string `json:"telegram_bot"`
}

func (h *Handler) settingsOf(email, tg bool, chat *int64) settings {
	return settings{Email: email, Telegram: tg, TelegramLinked: chat != nil, TelegramBot: h.Bot.Username()}
}

func (h *Handler) getSettings(w http.ResponseWriter, r *http.Request) {
	s, err := h.Svc.Q.GetNotificationSettings(r.Context(), reqctx.MustPrincipal(r.Context()).UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, h.settingsOf(s.NotifyEmail, s.NotifyTelegram, s.TelegramChatID))
}

type settingsRequest struct {
	Email    bool `json:"email"`
	Telegram bool `json:"telegram"`
}

func (h *Handler) putSettings(w http.ResponseWriter, r *http.Request) {
	var req settingsRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	s, err := h.Svc.Q.SetNotificationSettings(r.Context(), gen.SetNotificationSettingsParams{
		ID: reqctx.MustPrincipal(r.Context()).UserID, NotifyEmail: req.Email, NotifyTelegram: req.Telegram,
	})
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, h.settingsOf(s.NotifyEmail, s.NotifyTelegram, s.TelegramChatID))
}

// telegramLink returns a t.me deep link; pressing Start in the bot sends "/start <token>"
// to our webhook, which binds that chat to this account.
func (h *Handler) telegramLink(w http.ResponseWriter, r *http.Request) {
	token := random.Base36(24)
	uid := reqctx.MustPrincipal(r.Context()).UserID
	if err := h.RDB.Set(r.Context(), "tg:link:"+token, uid.String(), telegramLinkTTL).Err(); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{
		"url": "https://t.me/" + h.Bot.Username() + "?start=" + token, "expires_in": int(telegramLinkTTL.Seconds()),
	})
}

func (h *Handler) telegramUnlink(w http.ResponseWriter, r *http.Request) {
	uid := reqctx.MustPrincipal(r.Context()).UserID
	s, err := h.Svc.Q.GetNotificationSettings(r.Context(), uid)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	if s.TelegramChatID != nil {
		if err := h.Svc.Q.ClearTelegramChat(r.Context(), s.TelegramChatID); err != nil {
			response.Error(w, r, err)
			return
		}
	}
	response.NoContent(w)
}

type update struct {
	Message *struct {
		Text string `json:"text"`
		Chat struct {
			ID   int64  `json:"id"`
			Type string `json:"type"`
		} `json:"chat"`
		From struct {
			LanguageCode string `json:"language_code"`
		} `json:"from"`
	} `json:"message"`
}

var botReplies = map[string]map[string]string{
	"linked":  {"uz": "✅ Hisobingiz ulandi. Endi bildirishnomalar shu yerga keladi.", "ru": "✅ Аккаунт подключён. Уведомления будут приходить сюда.", "en": "✅ Your account is connected. Notifications will arrive here."},
	"expired": {"uz": "Havola eskirgan. Saytda «Telegram'ni ulash» tugmasini qayta bosing.", "ru": "Ссылка устарела. Нажмите «Подключить Telegram» на сайте ещё раз.", "en": "This link has expired. Press “Connect Telegram” on the website again."},
	"stopped": {"uz": "Bildirishnomalar o'chirildi.", "ru": "Уведомления отключены.", "en": "Notifications are turned off."},
	"hello":   {"uz": "Salom! Bu Job Vacancy bildirishnomalar boti. Ulash uchun saytdagi profilingizdan «Telegram'ni ulash» ni bosing.", "ru": "Здравствуйте! Это бот уведомлений Job Vacancy. Чтобы подключиться, нажмите «Подключить Telegram» в профиле на сайте.", "en": "Hi! This is the Job Vacancy notification bot. To connect, press “Connect Telegram” in your profile on the website."},
}

func reply(key, lang string) string {
	switch {
	case strings.HasPrefix(lang, "ru"):
		return botReplies[key]["ru"]
	case strings.HasPrefix(lang, "en"):
		return botReplies[key]["en"]
	}
	return botReplies[key]["uz"]
}

// telegramWebhook handles /start <token> (link) and /stop (unlink). It always answers
// 200 so Telegram doesn't retry updates we deliberately ignore.
func (h *Handler) telegramWebhook(w http.ResponseWriter, r *http.Request) {
	got := r.Header.Get("X-Telegram-Bot-Api-Secret-Token")
	if subtle.ConstantTimeCompare([]byte(got), []byte(h.WebhookSecret)) != 1 {
		response.Error(w, r, apperr.Unauthorized("bad_webhook_secret", "invalid webhook secret"))
		return
	}
	var u update
	if err := response.Decode(r, &u); err != nil || u.Message == nil || u.Message.Chat.Type != "private" {
		w.WriteHeader(http.StatusOK)
		return
	}
	ctx, chat, lang := r.Context(), u.Message.Chat.ID, u.Message.From.LanguageCode
	cmd, arg, _ := strings.Cut(strings.TrimSpace(u.Message.Text), " ")
	switch cmd {
	case "/start":
		if arg == "" {
			h.say(ctx, chat, reply("hello", lang))
			break
		}
		uid, err := h.RDB.GetDel(ctx, "tg:link:"+arg).Result()
		id, perr := uuid.Parse(uid)
		if errors.Is(err, redis.Nil) || perr != nil {
			h.say(ctx, chat, reply("expired", lang))
			break
		}
		// One chat belongs to one account: detach it from any previous owner first.
		_ = h.Svc.Q.ClearTelegramChat(ctx, &chat)
		if err := h.Svc.Q.SetTelegramChat(ctx, gen.SetTelegramChatParams{ID: id, TelegramChatID: &chat}); err != nil {
			h.Svc.Log.ErrorContext(ctx, "link telegram", "err", err)
			break
		}
		h.say(ctx, chat, reply("linked", lang))
	case "/stop":
		_ = h.Svc.Q.ClearTelegramChat(ctx, &chat)
		h.say(ctx, chat, reply("stopped", lang))
	}
	w.WriteHeader(http.StatusOK)
}

func (h *Handler) say(ctx context.Context, chat int64, text string) {
	if err := h.Bot.Send(ctx, chat, escapeHTML(text), nil); err != nil {
		h.Svc.Log.WarnContext(ctx, "telegram reply failed", "err", err)
	}
}

type deviceRequest struct {
	Token    string `json:"token" validate:"required,max=4096"`
	Platform string `json:"platform" validate:"required,oneof=android ios web"`
}

func (h *Handler) addDevice(w http.ResponseWriter, r *http.Request) {
	var req deviceRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	err := h.Svc.Q.UpsertDeviceToken(r.Context(), gen.UpsertDeviceTokenParams{
		Token: req.Token, UserID: reqctx.MustPrincipal(r.Context()).UserID, Platform: req.Platform,
	})
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

func (h *Handler) removeDevice(w http.ResponseWriter, r *http.Request) {
	err := h.Svc.Q.DeleteDeviceToken(r.Context(), gen.DeleteDeviceTokenParams{
		Token: chi.URLParam(r, "token"), UserID: reqctx.MustPrincipal(r.Context()).UserID,
	})
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}
