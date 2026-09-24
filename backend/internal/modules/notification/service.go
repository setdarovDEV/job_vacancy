// Package notification records in-app notifications, pushes them live, and delivers
// them by e-mail, Telegram and mobile push according to each user's settings.
package notification

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/riverqueue/river"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/platform/mailer"
	"jobvacancy.uz/backend/internal/platform/postgres"
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

// Inserter enqueues delivery jobs inside the caller's transaction (River InsertManyTx).
type Inserter interface {
	InsertManyTx(ctx context.Context, tx pgx.Tx, args []river.JobArgs) error
}

type Service struct {
	// Pool runs Notify, which has no business transaction to join.
	Pool      *pgxpool.Pool
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

// Recipient is one user and the payload they get.
type Recipient struct {
	UserID  uuid.UUID
	Payload Payload
}

// Sent is what a *Tx call recorded. Its live events go out only after the transaction
// commits: call Publish then (and never if it rolled back).
type Sent struct {
	svc    *Service
	events []realtime.Targeted
}

// Publish pushes the in-app notifications to open WebSockets, all in one Redis round
// trip. Losing them (a crash right after commit) is harmless: the notifications are
// stored and their delivery jobs are already queued.
func (s Sent) Publish(ctx context.Context) {
	if s.svc == nil || len(s.events) == 0 {
		return
	}
	if err := s.svc.Publisher.Send(ctx, s.events); err != nil {
		s.svc.Log.WarnContext(ctx, "publish notifications", "count", len(s.events), "err", err)
	}
}

// target is one recipient row: the stored notification (if any) and the channels the
// user has.
type target struct {
	userID                        uuid.UUID
	id                            *int64
	at                            *time.Time
	payload                       Payload
	hasEmail, hasTelegram, hasPush bool
}

// NotifyTx records notifications inside the caller's business transaction (TZ BE-08, an
// outbox): the stored rows (when store) and their delivery jobs commit or roll back with
// the change that caused them, so a crash after commit loses nothing. Jobs are created
// only for channels the user has (e-mail on and verified, Telegram linked, a device
// registered). Two round trips: one statement for the rows and channels, one River insert.
// Transient notifications (store=false, new chat message) only go out through channels.
func (s *Service) NotifyTx(ctx context.Context, tx pgx.Tx, typ string, to []Recipient, store bool) (Sent, error) {
	to = uniqueRecipients(to)
	if len(to) == 0 {
		return Sent{}, nil
	}
	ids := make([]uuid.UUID, len(to))
	payloads := make([]string, len(to))
	byUser := make(map[uuid.UUID]Payload, len(to))
	for i, r := range to {
		raw, err := json.Marshal(r.Payload)
		if err != nil {
			return Sent{}, err
		}
		ids[i], payloads[i] = r.UserID, string(raw)
		byUser[r.UserID] = r.Payload
	}
	rows, err := s.Q.WithTx(tx).NotifyUsers(ctx, gen.NotifyUsersParams{UserIds: ids, Payloads: payloads, Type: typ, Store: store})
	if err != nil {
		return Sent{}, fmt.Errorf("store notifications: %w", err)
	}
	targets := make([]target, len(rows))
	for i, r := range rows {
		targets[i] = target{userID: r.UserID, id: r.NotificationID, at: r.NotifiedAt, payload: byUser[r.UserID],
			hasEmail: r.HasEmail, hasTelegram: r.HasTelegram, hasPush: r.HasPush}
	}
	return s.enqueue(ctx, tx, typ, targets)
}

// NotifyCompanyTx is NotifyTx for every member of a company (stored, one payload).
func (s *Service) NotifyCompanyTx(ctx context.Context, tx pgx.Tx, companyID uuid.UUID, typ string, p Payload) (Sent, error) {
	raw, err := json.Marshal(p)
	if err != nil {
		return Sent{}, err
	}
	rows, err := s.Q.WithTx(tx).NotifyCompanyMembers(ctx, gen.NotifyCompanyMembersParams{Type: typ, Payload: raw, CompanyID: companyID})
	if err != nil {
		return Sent{}, fmt.Errorf("store company notifications: %w", err)
	}
	targets := make([]target, len(rows))
	for i, r := range rows {
		id, at := r.NotificationID, r.NotifiedAt
		targets[i] = target{userID: r.UserID, id: &id, at: &at, payload: p,
			hasEmail: r.HasEmail, hasTelegram: r.HasTelegram, hasPush: r.HasPush}
	}
	return s.enqueue(ctx, tx, typ, targets)
}

// enqueue queues one delivery job per recipient and channel they have, in tx, and
// prepares the live events.
func (s *Service) enqueue(ctx context.Context, tx pgx.Tx, typ string, targets []target) (Sent, error) {
	var jobs []river.JobArgs
	sent := Sent{svc: s}
	for _, t := range targets {
		if t.hasTelegram {
			jobs = append(jobs, DeliverArgs{UserID: t.userID, Channel: ChannelTelegram, Type: typ, Payload: t.payload, NotificationID: t.id})
		}
		if t.hasPush {
			jobs = append(jobs, DeliverArgs{UserID: t.userID, Channel: ChannelPush, Type: typ, Payload: t.payload, NotificationID: t.id})
		}
		// Chat messages would flood the inbox; they go out by Telegram and push only.
		if t.hasEmail && typ != TypeMessageNew {
			jobs = append(jobs, DeliverArgs{UserID: t.userID, Channel: ChannelEmail, Type: typ, Payload: t.payload, NotificationID: t.id})
		}
		if t.id != nil {
			sent.events = append(sent.events, realtime.Targeted{UserID: t.userID, Event: realtime.Event{
				Type: "notification.new", Data: DTO{ID: *t.id, Type: typ, Payload: t.payload, CreatedAt: *t.at},
			}})
		}
	}
	if len(jobs) > 0 {
		if err := s.Jobs.InsertManyTx(ctx, tx, jobs); err != nil {
			return Sent{}, fmt.Errorf("enqueue notification delivery: %w", err)
		}
	}
	jobsEnqueued.Add(float64(len(jobs)))
	return sent, nil
}

// Notify sends notifications that have no business transaction to join (saved-search
// alerts, admin actions): the rows and jobs still commit together, then the live events
// go out. Failures are logged, not returned: a notification must never break the action
// that triggered it.
func (s *Service) Notify(ctx context.Context, users []uuid.UUID, typ string, p Payload, store bool) {
	to := make([]Recipient, len(users))
	for i, u := range users {
		to[i] = Recipient{UserID: u, Payload: p}
	}
	s.NotifyEach(ctx, typ, to, store)
}

// NotifyEach is Notify with a payload per recipient.
func (s *Service) NotifyEach(ctx context.Context, typ string, to []Recipient, store bool) {
	var sent Sent
	err := postgres.WithPgxTx(ctx, s.Pool, func(tx pgx.Tx) error {
		var err error
		sent, err = s.NotifyTx(ctx, tx, typ, to, store)
		return err
	})
	if err != nil {
		s.Log.ErrorContext(ctx, "notify", "type", typ, "err", err)
		return
	}
	sent.Publish(ctx)
}

var jobsEnqueued = promauto.NewCounter(prometheus.CounterOpts{
	Name: "notification_jobs_enqueued_total",
	Help: "Notification delivery jobs enqueued (only for channels the recipient has).",
})

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

// uniqueRecipients drops nil and repeated users (the first payload wins).
func uniqueRecipients(to []Recipient) []Recipient {
	out := make([]Recipient, 0, len(to))
	for _, r := range to {
		if r.UserID != uuid.Nil && !slices.ContainsFunc(out, func(o Recipient) bool { return o.UserID == r.UserID }) {
			out = append(out, r)
		}
	}
	return out
}
