// Package feedback is the "Fikr bildirish" channel: anyone (signed in or not) sends a
// message to the team; administrators read it in /admin/feedback and mark it handled.
package feedback

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/netip"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/riverqueue/river"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/cursor"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
)

var ErrNotFound = apperr.NotFound("feedback_not_found", "feedback not found")

// Store is the part of the generated queries this module uses.
type Store interface {
	CreateFeedback(ctx context.Context, arg gen.CreateFeedbackParams) (gen.Feedback, error)
	ListFeedback(ctx context.Context, arg gen.ListFeedbackParams) ([]gen.ListFeedbackRow, error)
	GetFeedback(ctx context.Context, id uuid.UUID) (gen.GetFeedbackRow, error)
	SetFeedbackHandled(ctx context.Context, arg gen.SetFeedbackHandledParams) (int64, error)
}

// Inserter enqueues background jobs (River); the team-chat notice is one.
type Inserter interface {
	InsertMany(ctx context.Context, args []river.JobArgs) error
}

type Service struct {
	Store Store
	// Jobs is set when new feedback should be posted to the team chat; nil = off.
	Jobs Inserter
	// SiteHost is the web app's host (from WEB_URL); page_url must point there.
	SiteHost string
	Log      *slog.Logger
}

// Status filters the admin queue.
type Status string

const (
	StatusOpen    Status = "open"
	StatusHandled Status = "handled"
)

var Statuses = []Status{StatusOpen, StatusHandled}

func (s Status) Valid() bool { return s == StatusOpen || s == StatusHandled }

type Input struct {
	UserID   *uuid.UUID
	Category gen.FeedbackCategory
	Message  string
	Contact  string
	PageURL  string
	IP       netip.Addr
}

// Item is one feedback message as administrators see it.
type Item struct {
	ID        uuid.UUID
	Category  gen.FeedbackCategory
	Message   string
	Contact   *string
	PageURL   *string
	UserID    *uuid.UUID
	UserName  *string
	UserEmail *string
	HandledAt *time.Time
	CreatedAt time.Time
}

// Message length after trimming, in characters.
const (
	minMessage = 5
	maxMessage = 2000
)

func (s *Service) Submit(ctx context.Context, in Input) (Item, error) {
	msg := strings.TrimSpace(in.Message)
	switch n := utf8.RuneCountInString(msg); {
	case n < minMessage:
		return Item{}, apperr.Validation(map[string]string{"message": fmt.Sprintf("min=%d", minMessage)})
	case n > maxMessage:
		return Item{}, apperr.Validation(map[string]string{"message": fmt.Sprintf("max=%d", maxMessage)})
	}
	var ip *netip.Addr
	if in.IP.IsValid() {
		ip = &in.IP
	}
	row, err := s.Store.CreateFeedback(ctx, gen.CreateFeedbackParams{
		UserID: in.UserID, Category: in.Category, Message: msg,
		Contact: nonEmpty(in.Contact), PageUrl: s.pageURL(in.PageURL), Ip: ip,
	})
	if err != nil {
		return Item{}, err
	}
	if s.Jobs != nil {
		// The message is stored; a failed enqueue only loses the chat notice.
		if err := s.Jobs.InsertMany(ctx, []river.JobArgs{NotifyArgs{FeedbackID: row.ID}}); err != nil {
			s.Log.WarnContext(ctx, "feedback notice not queued", "feedback_id", row.ID, "err", err)
		}
	}
	return Item{ID: row.ID, Category: row.Category, Message: row.Message, Contact: row.Contact,
		PageURL: row.PageUrl, UserID: row.UserID, CreatedAt: row.CreatedAt}, nil
}

// pageURL keeps only absolute http(s) links to this site; anything else (another host,
// javascript:, relative paths) is dropped, so the admin queue never links elsewhere.
func (s *Service) pageURL(raw string) *string {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || s.SiteHost == "" || !strings.EqualFold(u.Host, s.SiteHost) {
		return nil
	}
	clean := u.String()
	return &clean
}

type Filter struct {
	Status Status // required; the handler defaults it to open
	After  *cursor.TimeID
	Limit  int
}

func (s *Service) List(ctx context.Context, f Filter) ([]Item, cursor.Meta, error) {
	if !f.Status.Valid() {
		return nil, cursor.Meta{}, apperr.Validation(map[string]string{"status": apperr.OneOf(Statuses)})
	}
	if f.Limit <= 0 {
		f.Limit = cursor.AdminDefaultLimit
	}
	p := gen.ListFeedbackParams{Handled: f.Status == StatusHandled, MaxResults: int32(f.Limit + 1)}
	if f.After != nil {
		p.AfterAt, p.AfterID = &f.After.T, &f.After.ID
	}
	rows, err := s.Store.ListFeedback(ctx, p)
	if err != nil {
		return nil, cursor.Meta{}, err
	}
	page, meta := cursor.Page(rows, f.Limit, func(r gen.ListFeedbackRow) any { return cursor.TimeID{T: r.CreatedAt, ID: r.ID} })
	out := make([]Item, len(page))
	for i, r := range page {
		out[i] = itemFrom(r)
	}
	return out, meta, nil
}

// SetHandled marks a message handled (or open again) and returns it as the queue shows it.
// Repeating it is harmless.
func (s *Service) SetHandled(ctx context.Context, admin reqctx.Principal, id uuid.UUID, handled bool) (Item, error) {
	n, err := s.Store.SetFeedbackHandled(ctx, gen.SetFeedbackHandledParams{Handled: handled, AdminID: &admin.UserID, ID: id})
	if err != nil {
		return Item{}, err
	}
	if n == 0 {
		return Item{}, ErrNotFound
	}
	r, err := s.Store.GetFeedback(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Item{}, ErrNotFound
	}
	if err != nil {
		return Item{}, err
	}
	return itemFrom(gen.ListFeedbackRow(r)), nil
}

// Get loads one message (the notification job).
func (s *Service) Get(ctx context.Context, id uuid.UUID) (Item, error) {
	r, err := s.Store.GetFeedback(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Item{}, ErrNotFound
	}
	if err != nil {
		return Item{}, err
	}
	return itemFrom(gen.ListFeedbackRow(r)), nil
}

// itemFrom maps a queue row (GetFeedbackRow has the same fields and converts to it).
func itemFrom(r gen.ListFeedbackRow) Item {
	return Item{ID: r.ID, Category: r.Category, Message: r.Message, Contact: r.Contact, PageURL: r.PageUrl,
		UserID: r.UserID, UserName: r.UserName, UserEmail: r.UserEmail, HandledAt: r.HandledAt, CreatedAt: r.CreatedAt}
}

func nonEmpty(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}
