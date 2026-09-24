// Package report lets users report vacancies and admins work through the reports
// (TZ FN-02). Enough open reports from different users send a published vacancy back to
// moderation automatically; an admin then approves or rejects it and closes the reports.
package report

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/audit"
	"jobvacancy.uz/backend/internal/modules/notification"
	"jobvacancy.uz/backend/internal/modules/vacancy"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/ratelimit"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/platform/postgres"
)

var (
	ErrAlreadyReported = apperr.Conflict("already_reported", "you have already reported this vacancy")
	ErrOwnVacancy      = apperr.Conflict("own_vacancy", "you can't report your own company's vacancy")
	ErrNotFound        = apperr.NotFound("report_not_found", "report not found")
	ErrClosed          = apperr.Conflict("report_closed", "this report is already closed")
	errComment         = apperr.Validation(map[string]string{"comment": "required"})
)

// DefaultThreshold is how many open reports (each from a different user) send a
// published vacancy back to moderation.
const DefaultThreshold = 3

// Users may file this many reports a day (TZ FN-02).
var reportRule = ratelimit.Rule{Name: "report_user", Limit: 10, Window: 24 * time.Hour}

type Service struct {
	Pool      *pgxpool.Pool
	Q         *gen.Queries
	Limiter   *ratelimit.Limiter
	Vacancies *vacancy.Service
	Notify    *notification.Service // nil: the author isn't told
	// Threshold of open reports; 0 means DefaultThreshold.
	Threshold int
	Log       *slog.Logger
}

// Input is a user's report.
type Input struct {
	Reason  string `json:"reason" validate:"required,oneof=spam fraud offensive discrimination misleading duplicate other"`
	Comment string `json:"comment" validate:"max=1000"`
}

// DTO is what the reporter gets back.
type DTO struct {
	ID        uuid.UUID `json:"id"`
	Reason    string    `json:"reason"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

func (s *Service) threshold() int64 {
	if s.Threshold > 0 {
		return int64(s.Threshold)
	}
	return DefaultThreshold
}

// Report files a report against a published vacancy (by id or slug). Members of the
// vacancy's company can't report it. When the report makes the threshold, the vacancy
// goes back to moderation and its author is told, in the same transaction.
func (s *Service) Report(ctx context.Context, p reqctx.Principal, ref string, in Input) (DTO, error) {
	in.Comment = strings.TrimSpace(in.Comment)
	if in.Reason == "other" && len([]rune(in.Comment)) < 5 {
		return DTO{}, errComment
	}
	d, member, err := s.Vacancies.Get(ctx, ref, &p)
	if err != nil {
		return DTO{}, err
	}
	if member && p.Role != string(gen.UserRoleAdmin) {
		return DTO{}, ErrOwnVacancy
	}
	if d.Status != string(gen.VacancyStatusPublished) {
		return DTO{}, vacancy.ErrNotFound
	}
	if ok, retry, err := s.Limiter.Allow(ctx, reportRule, p.UserID.String()); !ok {
		return DTO{}, apperr.TooManyRequests(int(retry.Seconds()) + 1)
	} else if err != nil {
		s.Log.WarnContext(ctx, "report rate limit unavailable", "err", err)
	}

	var rep gen.Report
	var sentBack bool
	var sent notification.Sent
	err = postgres.WithPgxTx(ctx, s.Pool, func(tx pgx.Tx) error {
		q := gen.New(tx)
		var err error
		rep, err = q.CreateReport(ctx, gen.CreateReportParams{
			ObjectID: d.ID, ReporterID: &p.UserID, Reason: gen.ReportReason(in.Reason), Comment: in.Comment,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrAlreadyReported
		}
		if err != nil {
			return err
		}
		n, err := q.CountOpenReports(ctx, gen.CountOpenReportsParams{ObjectType: gen.ReportObjectVacancy, ObjectID: d.ID})
		if err != nil || n < s.threshold() {
			return err
		}
		v, err := q.SubmitVacancy(ctx, gen.SubmitVacancyParams{ID: d.ID, FromStatuses: []string{"published"}})
		if errors.Is(err, pgx.ErrNoRows) {
			return nil // already back in moderation (or no longer published)
		}
		if err != nil {
			return err
		}
		sentBack = true
		if s.Notify == nil {
			return nil
		}
		sent, err = s.Notify.NotifyTx(ctx, tx, notification.TypeVacancyReported, []notification.Recipient{{
			UserID: v.CreatedBy, Payload: notification.Payload{VacancyID: v.ID.String(), VacancyTitle: v.Title},
		}}, true)
		return err
	})
	if err != nil {
		return DTO{}, err
	}
	if sentBack {
		sent.Publish(ctx)
		s.Vacancies.Cache.VacancyChanged(ctx, d.ID, d.Slug, d.Company.ID, d.Company.Slug)
		s.Log.InfoContext(ctx, "vacancy sent back to moderation by reports", "vacancy_id", d.ID)
	}
	return DTO{ID: rep.ID, Reason: string(rep.Reason), Status: string(rep.Status), CreatedAt: rep.CreatedAt}, nil
}

// ---- admin -------------------------------------------------------------------------------

// Item is a report in the admin queue.
type Item struct {
	ID             uuid.UUID    `json:"id"`
	ObjectType     string       `json:"object_type"`
	Reason         string       `json:"reason"`
	Comment        string       `json:"comment"`
	Status         string       `json:"status"`
	CreatedAt      time.Time    `json:"created_at"`
	ResolvedAt     *time.Time   `json:"resolved_at"`
	ResolvedBy     *uuid.UUID   `json:"resolved_by"`
	ResolutionNote string       `json:"resolution_note"`
	Reporter       *Person      `json:"reporter"`
	Vacancy        *VacancyInfo `json:"vacancy"`
	// OpenReports is how many open reports the same vacancy has (open queue only).
	OpenReports int64 `json:"open_reports"`
}

type Person struct {
	ID       uuid.UUID `json:"id"`
	FullName string    `json:"full_name"`
	Email    *string   `json:"email"`
}

type VacancyInfo struct {
	ID      uuid.UUID   `json:"id"`
	Title   string      `json:"title"`
	Slug    string      `json:"slug"`
	Status  string      `json:"status"`
	Company CompanyInfo `json:"company"`
}

type CompanyInfo struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
	Slug string    `json:"slug"`
}

// QueueFilter selects a page of the admin queue.
type QueueFilter struct {
	Status    string     // open (default) | resolved | dismissed
	VacancyID *uuid.UUID // only reports about this vacancy
	After     *uuid.UUID // keyset position (id of the previous page's last row)
	Limit     int
}

// Queue lists reports: open ones oldest first, closed ones newest first. One query.
func (s *Service) Queue(ctx context.Context, f QueueFilter) ([]Item, *uuid.UUID, error) {
	q := postgres.PlanPerCall(s.Pool)
	n := int32(f.Limit + 1)
	var items []Item
	if f.Status == "" || f.Status == string(gen.ReportStatusOpen) {
		rows, err := q.ListOpenReports(ctx, gen.ListOpenReportsParams{ObjectID: f.VacancyID, AfterID: f.After, MaxResults: n})
		if err != nil {
			return nil, nil, err
		}
		for _, r := range rows {
			items = append(items, item(gen.ListClosedReportsRow(r)))
		}
	} else {
		rows, err := q.ListClosedReports(ctx, gen.ListClosedReportsParams{Status: gen.ReportStatus(f.Status),
			ObjectID: f.VacancyID, BeforeID: f.After, MaxResults: n})
		if err != nil {
			return nil, nil, err
		}
		for _, r := range rows {
			items = append(items, item(r))
		}
	}
	if items == nil {
		items = []Item{}
	}
	var next *uuid.UUID
	if len(items) > f.Limit {
		items = items[:f.Limit]
		id := items[len(items)-1].ID
		next = &id
	}
	return items, next, nil
}

func item(r gen.ListClosedReportsRow) Item {
	it := Item{ID: r.ID, ObjectType: string(r.ObjectType), Reason: string(r.Reason), Comment: r.Comment,
		Status: string(r.Status), CreatedAt: r.CreatedAt, ResolvedAt: r.ResolvedAt, ResolvedBy: r.ResolvedBy,
		ResolutionNote: r.ResolutionNote, OpenReports: r.OpenReports}
	if r.ReporterID != nil {
		it.Reporter = &Person{ID: *r.ReporterID, Email: r.ReporterEmail}
		if r.ReporterName != nil {
			it.Reporter.FullName = *r.ReporterName
		}
	}
	if r.VacancyTitle != nil {
		v := &VacancyInfo{ID: r.ObjectID, Title: *r.VacancyTitle}
		if r.VacancySlug != nil {
			v.Slug = *r.VacancySlug
		}
		if r.VacancyStatus != nil {
			v.Status = string(*r.VacancyStatus)
		}
		if r.CompanyID != nil {
			v.Company.ID = *r.CompanyID
		}
		if r.CompanyName != nil {
			v.Company.Name = *r.CompanyName
		}
		if r.CompanySlug != nil {
			v.Company.Slug = *r.CompanySlug
		}
		it.Vacancy = v
	}
	return it
}

// Resolve closes a report as resolved or dismissed, or with all=true every open report
// about the same vacancy. Returns how many reports were closed.
func (s *Service) Resolve(ctx context.Context, admin reqctx.Principal, id uuid.UUID, status, note string, all bool) (int, error) {
	note = strings.TrimSpace(note)
	var n int
	err := postgres.WithTx(ctx, s.Pool, func(q *gen.Queries) error {
		rep, err := q.GetReport(ctx, id)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		if rep.Status != gen.ReportStatusOpen {
			return ErrClosed
		}
		ids, err := q.ResolveReports(ctx, gen.ResolveReportsParams{
			Status: gen.ReportStatus(status), AdminID: &admin.UserID, Note: note, ID: id,
			AllForObject: all, ObjectType: rep.ObjectType, ObjectID: rep.ObjectID,
		})
		if err != nil {
			return err
		}
		if n = len(ids); n == 0 {
			return ErrClosed // closed by someone else in the meantime
		}
		return audit.Write(ctx, q, audit.Entry{Action: "report." + status, ObjectType: audit.ObjectReport,
			ObjectID: id.String(), Details: map[string]any{"vacancy_id": rep.ObjectID, "closed": ids, "note": note}})
	})
	return n, err
}
