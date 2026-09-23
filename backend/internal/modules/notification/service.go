// Package notification records in-app notifications, pushes them live, and delivers
// them by e-mail, Telegram and mobile push according to each user's settings.
package notification

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/riverqueue/river"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/platform/mailer"
	"jobvacancy.uz/backend/internal/platform/telegram"
	"jobvacancy.uz/backend/internal/realtime"
)

const (
	ChannelEmail    = "email"
	ChannelTelegram = "telegram"
	ChannelPush     = "push"
)

// DeliverArgs is one delivery attempt of one notification over one channel, so a failing
// channel retries alone and never re-sends through the others.
type DeliverArgs struct {
	UserID         uuid.UUID `json:"user_id"`
	Channel        string    `json:"channel"`
	Type           string    `json:"type"`
	Payload        Payload   `json:"payload"`
	NotificationID *int64    `json:"notification_id,omitempty"`
}

func (DeliverArgs) Kind() string { return "notification.deliver" }

func (DeliverArgs) InsertOpts() river.InsertOpts { return river.InsertOpts{MaxAttempts: 5} }

type Inserter interface {
	InsertMany(ctx context.Context, args []river.JobArgs) error
}

type Service struct {
	Q         *gen.Queries
	Publisher *realtime.Publisher
	Jobs      Inserter
	Log       *slog.Logger
}

// DTO is the in-app notification shape (list and live event).
type DTO struct {
	ID        int64      `json:"id"`
	Type      string     `json:"type"`
	Payload   Payload    `json:"payload"`
	ReadAt    *time.Time `json:"read_at"`
	CreatedAt time.Time  `json:"created_at"`
}

// Notify sends a notification to users. Stored notifications appear in the in-app list;
// transient ones (new chat message) only go out through the delivery channels.
// Failures are logged, not returned: a notification must never break the action that
// triggered it.
func (s *Service) Notify(ctx context.Context, users []uuid.UUID, typ string, p Payload, store bool) {
	users = unique(users)
	if len(users) == 0 {
		return
	}
	ids := map[uuid.UUID]*int64{}
	if store {
		raw, _ := json.Marshal(p)
		rows, err := s.Q.InsertNotifications(ctx, gen.InsertNotificationsParams{UserIds: users, Type: typ, Payload: raw})
		if err != nil {
			s.Log.ErrorContext(ctx, "store notification", "type", typ, "err", err)
			return
		}
		for _, r := range rows {
			id := r.ID
			ids[r.UserID] = &id
			ev := realtime.Event{Type: "notification.new", Data: DTO{ID: r.ID, Type: typ, Payload: p, CreatedAt: r.CreatedAt}}
			if err := s.Publisher.ToUsers(ctx, []uuid.UUID{r.UserID}, ev); err != nil {
				s.Log.WarnContext(ctx, "publish notification", "err", err)
			}
		}
	}
	channels := []string{ChannelTelegram, ChannelPush}
	if typ != TypeMessageNew { // chat messages would flood the inbox
		channels = append(channels, ChannelEmail)
	}
	var jobs []river.JobArgs
	for _, u := range users {
		for _, ch := range channels {
			jobs = append(jobs, DeliverArgs{UserID: u, Channel: ch, Type: typ, Payload: p, NotificationID: ids[u]})
		}
	}
	if err := s.Jobs.InsertMany(ctx, jobs); err != nil {
		s.Log.ErrorContext(ctx, "enqueue notification delivery", "type", typ, "err", err)
	}
}

// NotifyCompany notifies every member of a company.
func (s *Service) NotifyCompany(ctx context.Context, companyID uuid.UUID, typ string, p Payload) {
	members, err := s.Q.ListCompanyMemberIDs(ctx, companyID)
	if err != nil {
		s.Log.ErrorContext(ctx, "list company members", "err", err)
		return
	}
	s.Notify(ctx, members, typ, p, true)
}

// ---- delivery (runs in the worker) -----------------------------------------------------

// PushSender delivers mobile push notifications (FCM). Until Firebase credentials are
// configured the log implementation is used.
type PushSender interface {
	Send(ctx context.Context, token, title, body, url string) error
}

type LogPush struct{ Log *slog.Logger }

func (l LogPush) Send(_ context.Context, token, title, body, url string) error {
	l.Log.Info("DEV: push (not sent)", "token", token, "title", title, "url", url)
	return nil
}

type Deliverer struct {
	Q      *gen.Queries
	Mailer mailer.Mailer
	Bot    telegram.Bot
	Push   PushSender
	WebURL string
	Log    *slog.Logger
}

func (d *Deliverer) Deliver(ctx context.Context, a DeliverArgs) error {
	u, err := d.Q.GetNotificationTarget(ctx, a.UserID)
	if err != nil {
		return err
	}
	if u.Status != gen.UserStatusActive {
		return nil
	}
	lang := string(u.Locale)
	t, ok := render(a.Type, lang, a.Payload)
	if !ok {
		return river.JobCancel(errors.New("unknown notification type " + a.Type))
	}
	url := d.WebURL + t.Path

	switch a.Channel {
	case ChannelEmail:
		if !u.NotifyEmail || u.Email == nil || u.EmailVerifiedAt == nil {
			return nil
		}
		msg, err := mailer.RenderNotice(mailer.Notice{Locale: lang, To: *u.Email, Title: t.Title,
			Body: t.Body, Button: t.Button, URL: url, Footer: footers[langOr(lang)]})
		if err != nil {
			return river.JobCancel(err)
		}
		return d.Mailer.Send(ctx, msg)
	case ChannelTelegram:
		if !u.NotifyTelegram || u.TelegramChatID == nil {
			return nil
		}
		html := "<b>" + escapeHTML(t.Title) + "</b>"
		if t.Body != "" {
			html += "\n" + escapeHTML(t.Body)
		}
		err := d.Bot.Send(ctx, *u.TelegramChatID, html, &telegram.Button{Text: t.Button, URL: url})
		if errors.Is(err, telegram.ErrBlocked) {
			_ = d.Q.ClearTelegramChat(ctx, u.TelegramChatID)
			return nil
		}
		return err
	case ChannelPush:
		devices, err := d.Q.ListDeviceTokens(ctx, a.UserID)
		if err != nil {
			return err
		}
		for _, dev := range devices {
			if err := d.Push.Send(ctx, dev.Token, t.Title, t.Body, url); err != nil {
				d.Log.WarnContext(ctx, "push failed", "err", err)
			}
		}
		return nil
	}
	return river.JobCancel(errors.New("unknown channel " + a.Channel))
}

func langOr(l string) string {
	if _, ok := footers[l]; ok {
		return l
	}
	return "uz"
}

func unique(ids []uuid.UUID) []uuid.UUID {
	var out []uuid.UUID
	for _, id := range ids {
		if id != uuid.Nil && !slices.Contains(out, id) {
			out = append(out, id)
		}
	}
	return out
}
