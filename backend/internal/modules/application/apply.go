package application

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/company"
	"jobvacancy.uz/backend/internal/modules/notification"
	"jobvacancy.uz/backend/internal/modules/resume"
	"jobvacancy.uz/backend/internal/modules/vacancy"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/platform/postgres"
)

// applySQL checks everything an application needs and creates it in one statement: the
// applicant is verified, the vacancy is published and not their own company's, the
// resume is theirs. When a check fails nothing is written and the flags tell which one.
// It also bumps the vacancy's application counter and records the first pipeline event.
// A second application to the same vacancy fails on UNIQUE (vacancy_id, seeker_id).
const applySQL = `
WITH g AS (
    SELECT v.id AS vacancy_id, v.company_id, v.title, v.status::text AS vacancy_status,
           (u.email_verified_at IS NOT NULL OR u.phone_verified_at IS NOT NULL) AS verified,
           u.full_name,
           EXISTS (SELECT 1 FROM company_members m
                   WHERE m.company_id = v.company_id AND m.user_id = u.id) AS own_company,
           EXISTS (SELECT 1 FROM resumes r WHERE r.id = $3 AND r.user_id = u.id) AS owns_resume
    FROM users u
    LEFT JOIN vacancies v ON v.id = $2
    WHERE u.id = $1
), a AS (
    INSERT INTO applications (vacancy_id, company_id, seeker_id, resume_id, source, status, cover_letter)
    SELECT g.vacancy_id, g.company_id, $1, $3, 'apply', 'sent', $4
    FROM g
    WHERE g.verified AND g.vacancy_status = 'published' AND NOT g.own_company AND g.owns_resume
    RETURNING *
), inc AS (
    UPDATE vacancies SET applications_count = applications_count + 1
    WHERE id IN (SELECT vacancy_id FROM a)
), ev AS (
    INSERT INTO application_events (application_id, actor_id, to_status, note)
    SELECT a.id, $1, a.status, '' FROM a
)
SELECT g.vacancy_id, g.company_id, COALESCE(g.title, ''), g.vacancy_status, g.verified,
       g.full_name, g.own_company, g.owns_resume,
       a.id, a.source, a.status, a.cover_letter, a.viewed_at, a.status_changed_at, a.created_at
FROM g LEFT JOIN a ON true`

type applyRow struct {
	vacancyID, companyID *uuid.UUID
	title                string
	vacancyStatus        *string
	verified             bool
	fullName             string
	ownCompany           bool
	ownsResume           bool

	appID           *uuid.UUID
	source          *gen.ApplicationSource
	status          *gen.ApplicationStatus
	coverLetter     *string
	viewedAt        *time.Time
	statusChangedAt *time.Time
	createdAt       *time.Time
}

// verdict turns the guard flags into the error the old step-by-step checks returned, in
// the same order.
func (r applyRow) verdict() error {
	switch {
	case !r.verified:
		return company.ErrVerificationRequired
	case r.vacancyID == nil:
		return vacancy.ErrNotFound
	case r.vacancyStatus == nil || *r.vacancyStatus != string(gen.VacancyStatusPublished):
		return ErrVacancyClosed
	case r.ownCompany:
		return ErrOwnVacancy
	case !r.ownsResume:
		return resume.ErrNotFound
	case r.appID == nil:
		return errors.New("application: guard passed but nothing was inserted")
	}
	return nil
}

// Apply sends the seeker's resume to a published vacancy (TZ BE-12). The whole path is 5
// Postgres round trips, down from 12-15: BEGIN; one batch with the guarded insert (+
// counter + event) and the vacancy card for the response; the company members'
// notifications with their channels; the River insert of delivery jobs (skipped when no
// member has a channel); COMMIT. The live events go out afterwards in one Redis pipeline.
func (s *Service) Apply(ctx context.Context, p reqctx.Principal, vacancyID uuid.UUID, in ApplyInput) (Detail, error) {
	if p.Role != string(gen.UserRoleSeeker) {
		return Detail{}, ErrSeekerOnly
	}
	cover := strings.TrimSpace(in.CoverLetter)
	var row applyRow
	var card vacancy.Card
	var sent notification.Sent
	err := postgres.WithPgxTx(ctx, s.Pool, func(tx pgx.Tx) error {
		b := &pgx.Batch{}
		b.Queue(applySQL, p.UserID, vacancyID, in.ResumeID, cover).QueryRow(func(r pgx.Row) error {
			return r.Scan(&row.vacancyID, &row.companyID, &row.title, &row.vacancyStatus, &row.verified,
				&row.fullName, &row.ownCompany, &row.ownsResume,
				&row.appID, &row.source, &row.status, &row.coverLetter, &row.viewedAt, &row.statusChangedAt, &row.createdAt)
		})
		cards := vacancy.QueueCards(b, []uuid.UUID{vacancyID})
		if err := tx.SendBatch(ctx, b).Close(); err != nil {
			return err
		}
		if err := row.verdict(); err != nil {
			return err
		}
		card = cards()[vacancyID]
		var err error
		sent, err = s.Notify.NotifyCompanyTx(ctx, tx, *row.companyID, notification.TypeApplicationNew, notification.Payload{
			ApplicationID: row.appID.String(), VacancyID: vacancyID.String(), VacancyTitle: row.title,
			CandidateName: row.fullName,
		})
		return err
	})
	if isUniqueViolation(err) {
		return Detail{}, ErrAlreadyApplied
	}
	if errors.Is(err, pgx.ErrNoRows) { // no such user row: a deleted account's token
		return Detail{}, company.ErrVerificationRequired
	}
	if err != nil {
		return Detail{}, err
	}
	sent.Publish(ctx)
	a := gen.Application{
		ID: *row.appID, VacancyID: vacancyID, CompanyID: *row.companyID, SeekerID: p.UserID, ResumeID: in.ResumeID,
		Source: *row.source, Status: *row.status, CoverLetter: *row.coverLetter, ViewedAt: row.viewedAt,
		StatusChangedAt: *row.statusChangedAt, CreatedAt: *row.createdAt,
	}
	return Detail{
		Summary: summaryOf(a),
		Vacancy: &card,
		// The one event the statement just wrote (same transaction time as the row).
		Events: []Event{{To: string(a.Status), At: a.CreatedAt}},
	}, nil
}

func isUniqueViolation(err error) bool {
	var pe *pgconn.PgError
	return errors.As(err, &pe) && pe.Code == "23505"
}
